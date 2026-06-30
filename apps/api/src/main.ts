import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import "reflect-metadata";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT") ?? 4000;
  const corsOrigins = configService
    .get<string>("CORS_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(helmet());
  app.enableCors({
    origin: corsOrigins,
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );

  const openApiConfig = new DocumentBuilder()
    .setTitle("SME Invoice API")
    .setDescription("API foundation for the SME Invoice & Payment Reconciliation Platform.")
    .setVersion("0.1.0")
    .build();
  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup("docs", app, document);

  await app.listen(port);
}

void bootstrap();
