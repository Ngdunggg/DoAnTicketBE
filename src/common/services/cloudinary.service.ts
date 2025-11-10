import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import axios from 'axios';

export interface CloudinarySignature {
    uploadUrl: string;
}

export interface CloudinarySignaturePayload {
    apiKey: string;
    cloudName: string;
    folder: string;
    timestamp: number;
    signature: string;
    uploadUrl: string;
}

@Injectable()
export class CloudinaryService {
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly cloudName: string;
    private readonly defaultFolder: string;

    constructor() {
        this.apiKey = process.env.CLOUDINARY_API_KEY || '';
        this.apiSecret = process.env.CLOUDINARY_API_SECRET || '';
        this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
        this.defaultFolder = process.env.CLOUDINARY_FOLDER || '';
    }

    /**
     * Generate complete signed upload URL for Cloudinary
     * @param folder - Cloudinary folder to upload to
     * @returns Complete signed upload URL with publicId
     */
    generateUploadSignature(): CloudinarySignature {
        try {
            const timestamp = Math.floor(Date.now() / 1000);

            // Parameters to sign (only timestamp for basic upload)
            const paramsToSign = {
                timestamp: timestamp
            };

            // Sort parameters alphabetically and create string to sign
            const sortedParams = Object.keys(paramsToSign)
                .sort()
                .map(key => `${key}=${paramsToSign[key]}`)
                .join('&');

            // Create signature: stringToSign + secret
            const stringToSign = sortedParams;
            
            const signature = createHash('sha1')
                .update(stringToSign + this.apiSecret)
                .digest('hex');

            // Create signed upload URL with all required parameters
            const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload?api_key=${this.apiKey}&timestamp=${timestamp}&signature=${signature}`;

            return {
                uploadUrl,
            };
        } catch (error) {
            console.error('Error generating upload signature:', error);
            throw new Error('Failed to generate upload signature');
        }
    }

    /**
     * Generate unsigned upload parameters (for backward compatibility)
     * @param folder - Cloudinary folder to upload to
     * @returns Unsigned upload parameters
     */
    generateUnsignedParams(folder?: string): CloudinarySignaturePayload {
        const timestamp = Math.floor(Date.now() / 1000);
        const targetFolder = folder || this.defaultFolder;
        const paramsToSign = `folder=${targetFolder}&timestamp=${timestamp}`;
        const signature = createHash('sha1')
            .update(paramsToSign + this.apiSecret)
            .digest('hex');

        const payload: CloudinarySignaturePayload = {
            apiKey: this.apiKey,
            cloudName: this.cloudName,
            folder: targetFolder,
            timestamp,
            signature,
            uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`,
        };

        return payload;
    }

    async uploadBuffer(
        buffer: Buffer,
        mimeType: string,
        folder?: string,
        publicId?: string
    ): Promise<{ secure_url: string; public_id: string }> {
        const targetFolder = folder || this.defaultFolder;
        const fileDataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

        const timestamp = Math.floor(Date.now() / 1000);
        const params: Record<string, string | number> = { timestamp };
        if (targetFolder) params.folder = targetFolder;
        if (publicId) params.public_id = publicId;

        // Build signature string: keys in alphabetical order
        const signatureString = Object.keys(params)
            .sort()
            .map((key) => `${key}=${params[key]}`)
            .join('&');
        const signature = createHash('sha1')
            .update(signatureString + this.apiSecret)
            .digest('hex');

        const body = new URLSearchParams();
        body.set('file', fileDataUri);
        body.set('api_key', this.apiKey);
        body.set('timestamp', String(timestamp));
        if (targetFolder) body.set('folder', targetFolder);
        if (publicId) body.set('public_id', publicId);
        body.set('signature', signature);

        const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`;
        const res = await axios.post<{ secure_url: string; public_id: string }>(url, body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        return { secure_url: res.data.secure_url, public_id: res.data.public_id };
    }
}
