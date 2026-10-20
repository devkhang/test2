import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnterpriseEntity } from './enterprise.entity.js';
import { BaseService } from '../../commons/bases/base.service.js';

@Injectable()
export class EnterpriseService extends BaseService<EnterpriseEntity> {
  constructor(
    @InjectRepository(EnterpriseEntity)
    private readonly enterpriseRepository: Repository<EnterpriseEntity>,
  ) {
    super(enterpriseRepository);
  }

  async findByTaxCode(taxCode: string): Promise<EnterpriseEntity | null> {
    return this.enterpriseRepository.findOne({ where: { taxCode } });
  }
}
