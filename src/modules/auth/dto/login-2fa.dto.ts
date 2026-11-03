import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

export class Login2faDto {
  @ApiProperty({ description: "Temporary token issued from the first login step" })
  @IsString()
  preAuthToken!: string;

  @ApiProperty({ example: "123456", description: "6-digit TOTP code or backup code" })
  @IsString()
  @Length(6, 12, { message: "Code must be a 6-digit TOTP or a valid recovery code." })
  code!: string;
}

