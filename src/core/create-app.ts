import { INestApplication, Type, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import express, { Express } from 'express';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import helmet from 'helmet';

import { internalStateMiddleware } from './internal-state.js';
import { MainModule } from './main.module.js';

(BigInt.prototype as bigint & { toJSON(): number }).toJSON = function () {
  return Number(this);
};

export interface CreateAppOptions {
  secrets?: Record<string, ReturnType<typeof defineSecret>>;
  module: Type;
}

export interface App {
  nestApp: INestApplication;
  expressApp: Express;
}

let app: App | undefined;

export async function createApp(options: CreateAppOptions): Promise<App> {
  if (app) {
    return app;
  }
  const expressApp = express();
  const nestApp = await NestFactory.create(
    MainModule.create({
      secrets: Object.fromEntries(
        Object.entries(options.secrets ?? {}).map(([secretName, secret]) => [
          secretName,
          secret.value(),
        ]), // TODO extract into a function
      ),
      module: options.module,
    }),
    new ExpressAdapter(expressApp),
    {
      logger,
    },
  );

  nestApp
    .use(
      internalStateMiddleware(),
      helmet({
        contentSecurityPolicy: false,
      }),
      compression(),
    )
    .enableVersioning({
      type: VersioningType.URI,
      prefix: 'v',
    });
  const config = new DocumentBuilder()
    .setTitle('API')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(nestApp, config, {});
  SwaggerModule.setup('help', nestApp, document, {
    swaggerOptions: {
      displayRequestDuration: true,
      requestInterceptor: (request: unknown) =>
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        __request__interceptor(request),
    },
    customJsStr: `window.__request__interceptor = (request) => {
        const url = new URL(request.url);
        const endPoint = url.pathname;
        const origin = location.origin;
        const path = location.pathname.replace(/\\/help$/, '');
        request.url = origin + path + endPoint;
        return request;
      }`,
  });

  await nestApp.init();
  return (app = { expressApp, nestApp });
}