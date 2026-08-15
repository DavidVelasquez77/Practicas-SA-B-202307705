import {
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';


export class CreateRentalDto {

  @IsInt()
  @Min(1)
  comicId!: number;


  @IsOptional()
  @IsInt()
  @Min(1)
  dias = 7;
} 