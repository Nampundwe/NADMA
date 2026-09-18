import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 1024;
const COMPRESSION_QUALITY = 0.5;

export const compressImage = async (uri, options = {}) => {
  const maxDim = options.maxDimension || MAX_DIMENSION;
  const quality = options.quality || COMPRESSION_QUALITY;

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxDim, height: maxDim } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (error) {
    return uri;
  }
};

export const compressForProfile = async (uri) => {
  return compressImage(uri, { maxDimension: 512, quality: 0.6 });
};

export const compressForPost = async (uri) => {
  return compressImage(uri, { maxDimension: 1024, quality: 0.5 });
};

export const compressForChat = async (uri) => {
  return compressImage(uri, { maxDimension: 800, quality: 0.5 });
};
