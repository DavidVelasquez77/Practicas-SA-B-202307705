import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';


export interface RemoteResponse<T> {
  data: T;
  setCookie?: string;
  jwtRenewed?: string;
}


interface GraphQLResponse<T> {
  data?: T;

  errors?: Array<{
    message?: string;
  }>;
}


@Injectable()
export class MicroservicesClientService {

  private readonly authUrl: string;

  private readonly comicsUrl: string;

  private readonly rentalsUrl: string;

  private readonly copiesUrl: string;

  private readonly timeoutMs: number;


  constructor(
    configService: ConfigService,
  ) {

    this.authUrl =
      configService.getOrThrow<string>(
        'AUTH_SERVICE_URL',
      );

    this.comicsUrl =
      configService.getOrThrow<string>(
        'COMICS_SERVICE_URL',
      );

    this.rentalsUrl =
      configService.getOrThrow<string>(
        'RENTALS_SERVICE_URL',
      );

    this.copiesUrl =
      configService.getOrThrow<string>(
        'COPIES_SERVICE_URL',
      );

    this.timeoutMs = Number(
      configService.get<string>(
        'HTTP_TIMEOUT_MS',
        '5000',
      ),
    );
  }


  private async request<T>(
    url: string,
    method: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<RemoteResponse<T>> {

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        this.timeoutMs,
      );

    try {

      const response =
        await fetch(
          url,
          {
            method,

            headers: {
              'Content-Type':
                'application/json',

              ...headers,
            },

            body:
              body === undefined
                ? undefined
                : JSON.stringify(body),

            signal:
              controller.signal,
          },
        );


      const raw =
        await response.text();


      let parsed:
      | string
      | Record<string, any> = {};

      if (raw) {
      try {
          const json: unknown =
          JSON.parse(raw);

          if (
          typeof json === 'object' &&
          json !== null
          ) {
          parsed =
              json as Record<string, any>;
          } else {
          parsed = {
              message: String(json),
          };
          }
      } catch {
          parsed = {
          message: raw,
          };
       }
    } 


      if (!response.ok) {
        throw new HttpException(
          parsed,
          response.status,
        );
      }


      return {
        data: parsed as T,

        setCookie:
          response.headers.get(
            'set-cookie',
          ) ?? undefined,

        jwtRenewed:
          response.headers.get(
            'x-jwt-renewed',
          ) ?? undefined,
      };

    } catch (error) {

      if (
        error instanceof HttpException
      ) {
        throw error;
      }


      throw new BadGatewayException(
        'No fue posible comunicarse '
        + 'con un microservicio.',
      );

    } finally {

      clearTimeout(timeout);
    }
  }


  async authRegister(
    body: unknown,
  ): Promise<RemoteResponse<unknown>> {

    return this.request(
      `${this.authUrl}/auth/register`,
      'POST',
      body,
    );
  }


  async authLogin(
    body: unknown,
  ): Promise<RemoteResponse<unknown>> {

    return this.request(
      `${this.authUrl}/auth/login`,
      'POST',
      body,
    );
  }


  async authValidate(
    cookie: string,
  ): Promise<
    RemoteResponse<{
      valid: true;

      user: {
        id: number;
        role: 'Admin' | 'Cliente';
      };
    }>
  > {

    return this.request(
      `${this.authUrl}/auth/validate`,
      'GET',
      undefined,
      {
        Cookie: cookie,
      },
    );
  }


  private async graphql<T>(
    url: string,
    query: string,
    variables:
      Record<string, unknown> = {},
  ): Promise<T> {

    const result =
      await this.request<
        GraphQLResponse<T>
      >(
        url,
        'POST',
        {
          query,
          variables,
        },
      );


    if (
      result.data.errors &&
      result.data.errors.length > 0
    ) {

      throw new BadRequestException(
        result.data.errors[0]
          .message
          ?? 'Error GraphQL remoto.',
      );
    }


    if (!result.data.data) {
      throw new BadGatewayException(
        'El servicio GraphQL no '
        + 'devolvió datos.',
      );
    }


    return result.data.data;
  }


  async comicsGraphql<T>(
    query: string,
    variables:
      Record<string, unknown> = {},
  ): Promise<T> {

    return this.graphql<T>(
      this.comicsUrl,
      query,
      variables,
    );
  }


  async rentalsGraphql<T>(
    query: string,
    variables:
      Record<string, unknown> = {},
  ): Promise<T> {

    return this.graphql<T>(
      this.rentalsUrl,
      query,
      variables,
    );
  }


  async copiesRequest<T>(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<T> {

    const result =
      await this.request<T>(
        `${this.copiesUrl}${path}`,
        method,
        body,
      );

    return result.data;
  }
}