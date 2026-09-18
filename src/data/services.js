import { getAllCategories } from './firebaseStorage';

let _cachedCategories = null;

export const getCategories = async () => {
  if (_cachedCategories) return _cachedCategories;
  _cachedCategories = await getAllCategories();
  return _cachedCategories;
};

export const refreshCategories = async () => {
  _cachedCategories = await getAllCategories();
  return _cachedCategories;
};

export const categories = [];

export const allServices = [];

export const getServicesByCategory = (categoryName) => {
  return [];
};

export const searchServices = (query) => {
  return [];
};
