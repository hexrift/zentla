import { Module, Global } from "@nestjs/common";
import { ExperimentsService } from "./experiments.service";

@Global()
@Module({
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
