import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";

export class MagicLinkRequestDto {
  @ApiProperty({ example: "client@example.com" })
  @IsEmail({}, { message: "Please enter a valid email address." })
  email!: string;
}

export class MagicLinkVerifyDto {
  @ApiProperty({ description: "Single-use magic link token received via email" })
  @IsString()
  token!: string;
}

