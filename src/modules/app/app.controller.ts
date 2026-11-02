import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";

@Controller()
export class AppController {
  @Get()
  @Public()
  getRoot() {
    return {
      message: "Hello World",
      health: "/health",
      resources: "/api/resources/:resource",
    };
  }

  @Get("health")
  @Public()
  health() {
    return { status: "ok", service: "codershub" };
  }
}
