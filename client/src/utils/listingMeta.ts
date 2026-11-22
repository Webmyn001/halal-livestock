import type { ListingSpecies, ListingStatus, ListingType, ListingUnit } from '../types';

export const SPECIES_LABELS: Record<ListingSpecies, string> = {
  rabbit: 'Rabbit',
  poultry: 'Poultry',
  sheep: 'Sheep',
  goat: 'Goat',
};

export const SPECIES_PLURALS: Record<ListingSpecies, string> = {
  rabbit: 'Rabbits',
  poultry: 'Poultry',
  sheep: 'Sheep',
  goat: 'Goats',
};

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  live: 'Live animal',
  halal_processed: 'Halal processed',
};

export const LISTING_TYPE_SHORT: Record<ListingType, string> = {
  live: 'Live',
  halal_processed: 'Halal processed',
};

export const UNIT_LABELS: Record<ListingUnit, string> = {
  bird: 'bird',
  head: 'head',
  crate: 'crate',
  kg: 'kilogram',
};

export const STATUS_LABELS: Record<ListingStatus, string> = {
  active: 'Available',
  under_process: 'Under process',
  sold: 'Sold',
  removed: 'Taken down',
};

export const STATUS_STYLES: Record<ListingStatus, string> = {
  active: 'bg-brand-50 text-brand-800 ring-brand-200',
  under_process: 'bg-amber-100 text-amber-900 ring-amber-300',
  sold: 'bg-red-100 text-red-900 ring-red-300',
  removed: 'bg-stone-100 text-stone-700 ring-stone-200',
};
