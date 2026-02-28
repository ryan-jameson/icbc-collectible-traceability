const encodeBase64 = (uint8Array) => {
  if (typeof btoa === 'function') {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  if (typeof globalThis !== 'undefined' && globalThis.Buffer) {
    return globalThis.Buffer.from(uint8Array).toString('base64');
  }

  return null;
};

export const buildCollectibleImageSrc = (collectible) => {
  if (!collectible) {
    return null;
  }

  const parseMetadata = (value) => {
    if (!value) {
      return null;
    }
    if (typeof value === 'object') {
      return value;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        return null;
      }
    }
    return null;
  };

  const metadata = parseMetadata(collectible.metadata);

  const resolvedMimeType =
    collectible.productPhotoMimeType ||
    collectible.product_photo_mime_type ||
    metadata?.productPhotoMimeType ||
    metadata?.product_photo_mime_type ||
    null;

  const productPhoto =
    collectible.productPhoto ||
    collectible.product_photo ||
    collectible.productPhotoBase64 ||
    collectible.product_photo_base64 ||
    metadata?.productPhoto ||
    metadata?.product_photo ||
    null;

  if (!productPhoto) {
    return null;
  }

  if (typeof productPhoto === 'string' && productPhoto.startsWith('data:')) {
    return productPhoto;
  }

  if (typeof productPhoto === 'object' && productPhoto !== null) {
    const { type, data, mimeType: objectMimeType } = productPhoto;
    if (Array.isArray(data)) {
      const uint8Array = new Uint8Array(data);
      const base64 = encodeBase64(uint8Array);
      if (!base64) {
        return null;
      }
      const finalMime = objectMimeType || type || resolvedMimeType || 'image/png';
      return `data:${finalMime};base64,${base64}`;
    }
  }

  return `data:${resolvedMimeType || 'image/png'};base64,${productPhoto}`;
};
