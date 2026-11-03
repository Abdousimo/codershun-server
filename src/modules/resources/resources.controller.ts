import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";

import { ResourcesService } from "./resources.service";

@Controller("api/resources")
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get(":resource/count")
  count(@Param("resource") resource: string) {
    return this.resources.count(resource);
  }

  @Get(":resource")
  list(
    @Param("resource") resource: string,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    return this.resources.list(resource, query);
  }

  @Get(":resource/:id")
  findOne(@Param("resource") resource: string, @Param("id") id: string) {
    return this.resources.findOne(resource, id);
  }

  @Post(":resource")
  create(@Param("resource") resource: string, @Body() data: unknown) {
    return this.resources.create(resource, data);
  }

  @Patch(":resource/:id")
  update(@Param("resource") resource: string, @Param("id") id: string, @Body() data: unknown) {
    return this.resources.update(resource, id, data);
  }

  @Delete(":resource/:id")
  remove(@Param("resource") resource: string, @Param("id") id: string) {
    return this.resources.remove(resource, id);
  }
}
