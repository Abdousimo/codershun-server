import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(
    @Query("skip", new ParseIntPipe({ optional: true })) skip = 0,
    @Query("take", new ParseIntPipe({ optional: true })) take = 50,
  ) {
    return this.usersService.findAll(Math.max(skip, 0), Math.max(take, 1));
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() data: Prisma.UsersUncheckedUpdateInput) {
    return this.usersService.update(id, data);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.usersService.remove(id);
  }
}
