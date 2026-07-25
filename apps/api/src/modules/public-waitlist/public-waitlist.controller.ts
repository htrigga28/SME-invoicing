import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";

import { CreateWaitlistEntryDto } from "./dto/create-waitlist-entry.dto";
import { PublicWaitlistService } from "./public-waitlist.service";

@ApiTags("Public")
@Controller("public/waitlist")
@UseGuards(ThrottlerGuard)
export class PublicWaitlistController {
  constructor(
    @Inject(PublicWaitlistService) private readonly publicWaitlistService: PublicWaitlistService
  ) {}

  @Post()
  createEntry(@Body() body: CreateWaitlistEntryDto) {
    return this.publicWaitlistService.createEntry(body);
  }
}
