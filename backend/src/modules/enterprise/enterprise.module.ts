import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnterpriseEntity } from './enterprise.entity.js';
import { EnterpriseService } from './enterprise.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([EnterpriseEntity])],
  providers: [EnterpriseService],
  exports: [EnterpriseService],
})
export class EnterpriseModule {}
