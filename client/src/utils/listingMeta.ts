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
  sold: 'Sold',
  removed: 'Taken down',
};

export const STATUS_STYLES: Record<ListingStatus, string> = {
  active: 'bg-brand-50 text-brand-800 ring-brand-200',
  sold: 'bg-stone-100 text-ink-700 ring-stone-300',
  removed: 'bg-amber-50 text-amber-800 ring-amber-200',
};
