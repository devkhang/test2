import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../commons/bases/base.entity.js';

// Hồ sơ doanh nghiệp – tạo khi doanh nghiệp tự đăng ký (users.enterprise_id trỏ về đây)
@Index(['taxCode'], { unique: true, where: 'deleted_at IS NULL' })
@Entity('enterprises')
export class EnterpriseEntity extends BaseEntity {
  @Column({ name: 'company_name' })
  companyName: string;

  @Column({ name: 'tax_code' })
  taxCode: string;

  @Column({ name: 'business_type', type: 'varchar', nullable: true })
  businessType: string | null;

  @Column({ name: 'main_industry', type: 'varchar', nullable: true })
  mainIndustry: string | null;

  @Column({ name: 'license_date', type: 'date', nullable: true })
  licenseDate: string | null;

  // Địa chỉ đăng ký kinh doanh
  @Column({ name: 'province_id', type: 'varchar', nullable: true })
  provinceId: string | null;

  @Column({ name: 'ward_id', type: 'varchar', nullable: true })
  wardId: string | null;

  @Column({ name: 'address', type: 'varchar', nullable: true })
  address: string | null;

  // Thông tin liên hệ
  @Column({ name: 'foreign_name', type: 'varchar', nullable: true })
  foreignName: string | null;

  @Column({ name: 'email', type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'office_phone', type: 'varchar', nullable: true })
  officePhone: string | null;

  @Column({ name: 'leader_name', type: 'varchar', nullable: true })
  leaderName: string | null;

  @Column({ name: 'leader_phone', type: 'varchar', nullable: true })
  leaderPhone: string | null;

  // Địa điểm hoạt động kinh doanh
  @Column({ name: 'operating_province_id', type: 'varchar', nullable: true })
  operatingProvinceId: string | null;

  @Column({ name: 'operating_ward_id', type: 'varchar', nullable: true })
  operatingWardId: string | null;

  @Column({ name: 'business_location', type: 'varchar', nullable: true })
  businessLocation: string | null;

  // File đính kèm: đường dẫn trên server + tên gốc người dùng tải lên
  @Column({ name: 'business_license_path', type: 'varchar', nullable: true })
  businessLicensePath: string | null;

  @Column({ name: 'business_license_name', type: 'varchar', nullable: true })
  businessLicenseName: string | null;

  @Column({ name: 'other_document_path', type: 'varchar', nullable: true })
  otherDocumentPath: string | null;

  @Column({ name: 'other_document_name', type: 'varchar', nullable: true })
  otherDocumentName: string | null;
}
