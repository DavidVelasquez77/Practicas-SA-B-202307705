import { ComicsService } from './comics.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Comics: reglas de catálogo', () => {
  it('normaliza los textos al crear un comic y conserva el precio', async () => {
    const create = jest.fn().mockResolvedValue({ id: 4 });
    const service = new ComicsService({ comic: { create } } as unknown as PrismaService);
    await expect(service.create({ titulo: ' Batman ', autor: ' Autor ', editorial: ' DC ', genero: ' Acción ', precioAlquiler: 12.5 })).resolves.toEqual({ id: 4 });
    expect(create).toHaveBeenCalledWith({ data: { titulo: 'Batman', autor: 'Autor', editorial: 'DC', genero: 'Acción', precioAlquiler: 12.5 } });
  });

  it('devuelve null cuando el comic consultado no existe', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = new ComicsService({ comic: { findUnique } } as unknown as PrismaService);
    await expect(service.findOne(999)).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
  });
});
