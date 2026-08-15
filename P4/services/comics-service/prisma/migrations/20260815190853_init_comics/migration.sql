-- CreateTable
CREATE TABLE "comics" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "autor" VARCHAR(120) NOT NULL,
    "editorial" VARCHAR(100) NOT NULL,
    "genero" VARCHAR(80) NOT NULL,
    "precioAlquiler" DOUBLE PRECISION NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comics_pkey" PRIMARY KEY ("id")
);
