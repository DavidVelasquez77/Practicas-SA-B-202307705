-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('Admin', 'Cliente');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(1024) NOT NULL,
    "correo" VARCHAR(1024) NOT NULL,
    "contrasena" VARCHAR(1024) NOT NULL,
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "nombre" "RoleName" NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
