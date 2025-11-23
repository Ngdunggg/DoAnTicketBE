import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Enable CORS cho frontend
    app.enableCors({
        origin: [
            'http://localhost:3000',
            'https://580m9rqm-3000.asse.devtunnels.ms',
            'exp://192.168.102.12:8081',
            // Add more origins as needed
            'https://nonfilterable-jared-unshingled.ngrok-free.dev',
            /^https:\/\/.*\.ngrok-free\.app$/,
            /^https:\/\/.*\.ngrok\.io$/,
        ],
        credentials: true, // Cho phép gửi cookies
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'ngrok-skip-browser-warning'],
        exposedHeaders: ['set-cookie'],
    });

    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(process.env.PORT ?? 5000);
}
void bootstrap();
