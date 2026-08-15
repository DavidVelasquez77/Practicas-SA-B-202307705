import {
  IsInt,
  IsString,
  Length,
  Min,
} from 'class-validator';


export class CreateCopyDto {

  @IsInt()
  @Min(1)
  comicId!: number;


  @IsString()
  @Length(2, 50)
  codigo!: string;
}