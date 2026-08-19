import { Types } from 'mongoose';
import { Country, type ICountry } from '../../models/Settings';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type ResolvedGeo = {
  country: string;
  countryId?: Types.ObjectId;
  regionId?: Types.ObjectId;
};

export async function resolveCountryGeo(input: {
  countryId?: string | null;
  countryName?: string | null;
}): Promise<ResolvedGeo> {
  let doc: ICountry | null = null;
  const id = input.countryId?.trim();
  const name = input.countryName?.trim() ?? '';
  if (id && Types.ObjectId.isValid(id)) {
    doc = await Country.findById(id);
    if (doc && name && doc.name.trim().toLowerCase() !== name.toLowerCase()) {
      doc = null;
    }
  }
  if (!doc && name) {
    doc = await Country.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
  }
  if (!doc) {
    return { country: name };
  }
  return {
    country: doc.name,
    countryId: doc._id as Types.ObjectId,
    regionId: doc.regionId || undefined,
  };
}

export function userGeoFromResolved(geo: ResolvedGeo) {
  return {
    assignedCountry: geo.country || undefined,
    regionIds: geo.regionId ? [geo.regionId] : [],
    scopedCountryIds: geo.countryId ? [geo.countryId] : [],
  };
}
