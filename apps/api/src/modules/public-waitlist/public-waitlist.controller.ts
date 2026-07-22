import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { CreateWaitlistEntryDto } from "./dto/create-waitlist-entry.dto";
import { PublicWaitlistService } from "./public-waitlist.service";

@ApiTags("Public")
@Controller("public/waitlist")
export class PublicWaitlistController {
  constructor(
    @Inject(PublicWaitlistService) private readonly publicWaitlistService: PublicWaitlistService
  ) {}

  @Post()
  createEntry(@Body() body: CreateWaitlistEntryDto) {
    return this.publicWaitlistService.createEntry(body);
  }
}
