"""Create and return bounded, real demo rentals through ComicRent's API.

This intentionally writes rental history to the application database. With
--register-demo-client it also creates one persistent demo account. It never
creates comics or copies and does not write directly to a database. The default
mode is a no-op; pass --apply to perform the business transactions.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.cookiejar import CookieJar
from uuid import uuid4


SERVICE = "comicrent-p9-workloads-api-gateway"
ROLLOUT = "comicrent-api-gateway-rollout"
NAMESPACE = "sa-p9"
MAX_RENTALS = 3
AVAILABILITY_TIMEOUT_SECONDS = 45


class ApiError(RuntimeError):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


class NoAvailableComic(RuntimeError):
    pass


def kubectl_json(*args: str) -> dict:
    result = subprocess.run(
        ["kubectl", *args, "-o", "json"],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def api_request(
    opener: urllib.request.OpenerDirector,
    method: str,
    url: str,
    *,
    payload: object | None = None,
    correlation_id: str | None = None,
) -> tuple[dict | list, dict[str, str]]:
    headers = {"Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if correlation_id:
        headers["X-Correlation-ID"] = correlation_id

    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with opener.open(request, timeout=15) as response:
            raw = response.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
            return data, dict(response.headers.items())
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
            detail = parsed.get("message") or parsed.get("detail") or raw
        except (json.JSONDecodeError, AttributeError):
            detail = raw
        raise ApiError(error.code, str(detail)[:500]) from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"No se pudo conectar con ComicRent: {error.reason}") from error


def gateway_url(override: str | None) -> str:
    if override:
        return override.rstrip("/")

    service = kubectl_json("get", "svc", SERVICE, "-n", NAMESPACE)
    ingress = service.get("status", {}).get("loadBalancer", {}).get("ingress", [])
    if not ingress:
        raise RuntimeError("El Service público del API Gateway no tiene IP asignada.")
    host = ingress[0].get("ip") or ingress[0].get("hostname")
    if not host:
        raise RuntimeError("No se pudo determinar la dirección del API Gateway.")
    return f"http://{host}:3000"


def require_healthy_rollout() -> None:
    rollout = kubectl_json("get", "rollout", ROLLOUT, "-n", NAMESPACE)
    phase = rollout.get("status", {}).get("phase")
    if phase != "Healthy":
        raise RuntimeError(f"El Canary no está Healthy (estado: {phase!r}); se cancela la operación.")


def active_comics(
    opener: urllib.request.OpenerDirector,
    base_url: str,
    requested_id: int | None,
) -> list[dict]:
    comics, _ = api_request(opener, "GET", f"{base_url}/api/comics")
    if not isinstance(comics, list):
        raise RuntimeError("La API no devolvió la lista de cómics esperada.")
    eligible = [comic for comic in comics if comic.get("activo") is True]
    if requested_id is not None:
        eligible = [comic for comic in eligible if comic.get("id") == requested_id]
        if not eligible:
            raise RuntimeError(f"El cómic {requested_id} no existe o está inactivo.")
    elif not eligible:
        raise RuntimeError("El catálogo no contiene cómics activos.")
    return eligible


def available_comic(
    opener: urllib.request.OpenerDirector,
    base_url: str,
    requested_id: int | None,
) -> dict:
    for comic in active_comics(opener, base_url, requested_id):
        try:
            copy, _ = api_request(
                opener,
                "GET",
                f"{base_url}/api/copies/available/by-comic/{comic['id']}",
            )
        except ApiError as error:
            if error.status == 404:
                continue
            raise
        if isinstance(copy, dict) and copy.get("id"):
            return comic
    if requested_id is not None:
        raise NoAvailableComic(f"El cómic {requested_id} no tiene ejemplares disponibles.")
    raise NoAvailableComic("No hay cómics activos con ejemplares disponibles.")


def wait_for_available_comic(
    opener: urllib.request.OpenerDirector,
    base_url: str,
    requested_id: int | None,
) -> dict:
    deadline = time.monotonic() + AVAILABILITY_TIMEOUT_SECONDS
    while True:
        try:
            return available_comic(opener, base_url, requested_id)
        except NoAvailableComic as error:
            if time.monotonic() >= deadline:
                raise RuntimeError(
                    f"No volvió a estar disponible un ejemplar en "
                    f"{AVAILABILITY_TIMEOUT_SECONDS} s: {error}"
                ) from error
            time.sleep(2)


def main() -> int:
    # Keep Windows terminals with legacy code pages from aborting a business
    # operation while printing non-ASCII comic titles or labels.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="backslashreplace")

    parser = argparse.ArgumentParser(
        description="Crea y devuelve rentas reales acotadas para mover las métricas de negocio de P10."
    )
    parser.add_argument("--count", type=int, default=1, help="Rentas a crear y devolver (1–3; default: 1).")
    parser.add_argument("--comic-id", type=int, help="Usa un cómic concreto; por defecto elige uno disponible.")
    parser.add_argument("--base-url", help="API Gateway; por defecto toma la IP del Service en Kubernetes.")
    parser.add_argument("--apply", action="store_true", help="Confirma que se escriban rentas reales en ComicRent.")
    parser.add_argument(
        "--register-demo-client",
        action="store_true",
        help="Registra un Cliente único en example.invalid, con contraseña aleatoria para esta ejecución.",
    )
    args = parser.parse_args()

    if not 1 <= args.count <= MAX_RENTALS:
        parser.error(f"--count debe estar entre 1 y {MAX_RENTALS}")
    if args.comic_id is not None and args.comic_id <= 0:
        parser.error("--comic-id debe ser mayor que cero")
    if args.register_demo_client and args.count != 1:
        parser.error("--register-demo-client solo permite --count 1.")

    if not args.apply:
        print("Simulación: no se llamó a la API ni se modificaron datos.")
        if args.register_demo_client:
            print("Al aplicar, también se registrará una cuenta Cliente única en example.invalid.")
        print(f"Al aplicar, se crearán y devolverán {args.count} renta(s) en ComicRent.")
        print("La base conservará las rentas con estado DEVUELTO; no se crearán cómics ni ejemplares.")
        print("Para ejecutar realmente, vuelve a correr el comando con --apply.")
        return 0

    try:
        require_healthy_rollout()
        base_url = gateway_url(args.base_url)
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
        if args.register_demo_client:
            email = f"demo-p10-{uuid4().hex[:12]}@example.invalid"
            password = f"{secrets.token_urlsafe(24)}Aa7!"
            registration, _ = api_request(
                opener,
                "POST",
                f"{base_url}/api/auth/register",
                payload={
                    "nombre": "ComicRent P Ten Demo",
                    "correo": email,
                    "contrasena": password,
                    "rol": "Cliente",
                },
                correlation_id=f"p10-demo-register-{uuid4().hex[:12]}",
            )
            registered_user = registration.get("user", {}) if isinstance(registration, dict) else {}
            if registered_user.get("rol") != "Cliente":
                raise RuntimeError("La API no confirmó el registro del usuario Cliente.")
            print(f"Cuenta Cliente de demostración registrada: {email}")
            print("La contraseña aleatoria se conserva solo en memoria durante esta ejecución.")
        else:
            email = os.environ.get("COMICRENT_DEMO_EMAIL", "").strip() or input(
                "Correo de una cuenta Cliente o Admin: "
            ).strip()
            password = getpass.getpass("Contraseña (no se mostrará): ")
            if not email or not password:
                raise RuntimeError("Se requiere correo y contraseña.")

        login, _ = api_request(
            opener,
            "POST",
            f"{base_url}/api/auth/login",
            payload={"correo": email, "contrasena": password},
            correlation_id=f"p10-demo-login-{uuid4().hex[:12]}",
        )
        user = login.get("user", {}) if isinstance(login, dict) else {}
        role = user.get("rol")
        if role not in ("Cliente", "Admin"):
            raise RuntimeError("La sesión no tiene un rol autorizado para crear rentas.")

        # Confirm the cookie works before any write request.
        active_comics(opener, base_url, args.comic_id)
        print(f"Inicio UTC: {utc_now()}")
        print(f"Cuenta validada ({role}); Canary Healthy; API: {base_url}")
        print(f"Se ejecutarán {args.count} ciclo(s) crear -> devolver; días de renta: 1.")
        print("Las solicitudes se registran como tráfico user y participan en los SLI de latencia.")

        completed = 0
        for index in range(args.count):
            comic = wait_for_available_comic(opener, base_url, args.comic_id)
            create_correlation = f"p10-demo-rental-create-{uuid4().hex[:12]}"
            rental, _ = api_request(
                opener,
                "POST",
                f"{base_url}/api/rentals",
                payload={"comicId": comic["id"], "dias": 1},
                correlation_id=create_correlation,
            )
            if not isinstance(rental, dict) or not rental.get("id"):
                raise RuntimeError("La API no confirmó la creación de la renta; detuve la ejecución.")

            rental_id = rental["id"]
            print(
                f"{index + 1}/{args.count}: creada renta={rental_id}, "
                f"comic={comic['id']} ({comic.get('titulo', 'sin título')}), "
                f"correlation_id={create_correlation}"
            )
            return_correlation = f"p10-demo-rental-return-{uuid4().hex[:12]}"
            try:
                returned, _ = api_request(
                    opener,
                    "PATCH",
                    f"{base_url}/api/rentals/{rental_id}/return",
                    correlation_id=return_correlation,
                )
            except ApiError as error:
                raise RuntimeError(
                    f"La renta {rental_id} sí se creó, pero la devolución falló "
                    f"(HTTP {error.status}: {error}). Revisa GET /api/rentals/{rental_id}; "
                    "no se repetirá la creación automáticamente."
                ) from error

            if not isinstance(returned, dict) or returned.get("estado") != "DEVUELTO":
                raise RuntimeError(
                    f"La renta {rental_id} se creó, pero la API no confirmó estado DEVUELTO. "
                    "Revisa esa renta antes de volver a ejecutar el script."
                )
            completed += 1
            print(
                f"{index + 1}/{args.count}: devuelta renta={rental_id}; "
                f"correlation_id={return_correlation}"
            )

        print(f"Fin UTC: {utc_now()}")
        print(f"OK: {completed} renta(s) creada(s) y devuelta(s) por la API.")
        print("Dale hasta 30 s a Prometheus/Grafana para recoger y mostrar las métricas.")
        print("Las rentas permanecen en la base con estado DEVUELTO; el ejemplar se libera por RabbitMQ.")
        return 0
    except (ApiError, RuntimeError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
