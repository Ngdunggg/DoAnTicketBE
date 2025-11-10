import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prismas.service';
import { CreateOrganizerProfileDto, CreatePaymentMethodDto } from '@common/dto/organizer.dto';
import { CloudinaryService } from '@common/services/cloudinary.service';

@Injectable()
export class OrganizerService {
    constructor(
        private prisma: PrismaService,
        private cloudinaryService: CloudinaryService
    ) {}

    async createOrUpdateOrganizerProfile(userId: string, profileData: CreateOrganizerProfileDto) {
        try {
            const existingProfile = await this.prisma.organizer_profiles.findFirst({
                where: { user_id: userId },
            });

            if (existingProfile) {
                // Update existing profile
                return this.prisma.organizer_profiles.update({
                    where: { id: existingProfile.id },
                    data: {
                        organization_name: profileData.organization_name,
                        full_name: profileData.full_name,
                        logo_url: profileData.logo_url,
                        contact_phone: profileData.contact_phone,
                        contact_email: profileData.contact_email,
                        website: profileData.website,
                        description_organization: profileData.description_organization,
                    },
                });
            } else {
                // Create new profile
                return this.prisma.organizer_profiles.create({
                    data: {
                        organization_name: profileData.organization_name,
                        full_name: profileData.full_name,
                        logo_url: profileData.logo_url, // Cloudinary URL
                        contact_phone: profileData.contact_phone,
                        contact_email: profileData.contact_email,
                        website: profileData.website,
                        user_id: userId,
                        description_organization: profileData.description_organization,
                    },
                });
            }
        } catch (error) {
            console.error('Error uploading organizer logo:', error);
            throw new BadRequestException(`Failed to upload organizer logo: ${(error as Error).message}`);
        }
    }

    async createOrganizerProfile(userId: string, profileData: CreateOrganizerProfileDto) {
        try {
            return this.prisma.organizer_profiles.create({
                data: {
                    organization_name: profileData.organization_name,
                    full_name: profileData.full_name,
                    logo_url: profileData.logo_url, // Cloudinary URL
                    contact_phone: profileData.contact_phone,
                    contact_email: profileData.contact_email,
                    website: profileData.website,
                    user_id: userId,
                    description_organization: profileData.description_organization,
                },
            });
        } catch (error) {
            console.error('Error uploading organizer logo:', error);
            throw new BadRequestException(`Failed to upload organizer logo: ${(error as Error).message}`);
        }
    }

    async createOrUpdatePaymentMethod(userId: string, paymentData: CreatePaymentMethodDto) {
        const existingPaymentMethod = await this.prisma.organizer_payment_methods.findFirst({
            where: { organizer_id: userId },
        });

        if (existingPaymentMethod) {
            // Update existing payment method
            return this.prisma.organizer_payment_methods.update({
                where: { id: existingPaymentMethod.id },
                data: {
                    bank_name: paymentData.bank_name,
                    bank_branch: paymentData.bank_branch,
                    account_number: paymentData.account_number,
                    account_holder_name: paymentData.account_holder_name,
                    payment_method: paymentData.payment_method,
                    updated_at: new Date(),
                },
            });
        } else {
            // Create new payment method
            return this.prisma.organizer_payment_methods.create({
                data: {
                    organizer_id: userId,
                    bank_name: paymentData.bank_name,
                    bank_branch: paymentData.bank_branch,
                    account_number: paymentData.account_number,
                    account_holder_name: paymentData.account_holder_name,
                    payment_method: paymentData.payment_method,
                    is_default: true,
                },
            });
        }
    }

    async createPaymentMethod(userId: string, paymentData: CreatePaymentMethodDto) {
        return this.prisma.organizer_payment_methods.create({
            data: {
                organizer_id: userId,
                bank_name: paymentData.bank_name,
                bank_branch: paymentData.bank_branch,
                account_number: paymentData.account_number,
                account_holder_name: paymentData.account_holder_name,
                payment_method: paymentData.payment_method,
                is_default: true,
            },
        });
    }

    async getOrganizerProfileByUserId(userId: string) {
        const organizerProfile = await this.prisma.organizer_profiles.findFirst({
            where: { user_id: userId },
        });

        const organizerPaymentMethods = await this.prisma.organizer_payment_methods.findFirst({
            where: { organizer_id: userId },
        });

        if (!organizerProfile || !organizerPaymentMethods) {
            throw new NotFoundException('Organizer profile not found');
        }

        return {
            organizer_profile: organizerProfile,
            payment_methods: organizerPaymentMethods,
        };
    }

    async getOrganizerProfile() {
        const organizerProfiles = await this.prisma.organizer_profiles.findMany();

        if (!organizerProfiles) {
            throw new NotFoundException('Organizer profiles not found');
        }

        return organizerProfiles;
    }
}
