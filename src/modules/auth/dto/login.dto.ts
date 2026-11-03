import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail({}, { message: "Please enter a valid email address." })
  email!: string;

  @ApiProperty({ example: "SecurePass123!" })
  @IsString({ message: "Password is required." })
  password!: string;
}
