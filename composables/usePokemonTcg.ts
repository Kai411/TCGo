// pokemontcg.io's price blocks. Both providers report multiple variants
// (normal, holofoil, reverseHolofoil, ...) each with low/mid/high/market.
// We let useMarketPrice pick the best variant + currency-convert to MYR.
export interface TcgPriceBlock {
  low?: number;
  mid?: number;
  high?: number;
  market?: number;
  directLow?: number;
}

export interface TcgPlayerPrices {
  url?: string;
  updatedAt?: string;
  prices?: Record<string, TcgPriceBlock | undefined>;
}

export interface CardMarketPrices {
  url?: string;
  updatedAt?: string;
  prices?: {
    averageSellPrice?: number;
    lowPrice?: number;
    trendPrice?: number;
    avg7?: number;
    avg30?: number;
  };
}

export interface TcgCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set: { id: string; name: string; series: string; printedTotal?: number };
  images: { small: string; large: string };
  tcgplayer?: TcgPlayerPrices;
  cardmarket?: CardMarketPrices;
}

interface TcgApiResponse {
  data: TcgCard[];
  totalCount: number;
}

const API_BASE = "https://api.pokemontcg.io/v2/cards";

const buildQuery = (name?: string, number?: string) => {
  const parts: string[] = [];
  if (name) {
    const escaped = name.replace(/"/g, "");
    parts.push(`name:"${escaped}*"`);
  }
  if (number) parts.push(`number:${number}`);
  return parts.join(" ");
};

export const usePokemonTcg = () => {
  const searchByNameAndNumber = async (
    name: string,
    number: string,
  ): Promise<TcgCard[]> => {
    const q = buildQuery(name, number);
    if (!q) return [];
    const url = `${API_BASE}?q=${encodeURIComponent(q)}&pageSize=12&orderBy=-set.releaseDate`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
    const json = (await res.json()) as TcgApiResponse;
    return json.data;
  };

  const searchByName = async (name: string): Promise<TcgCard[]> => {
    return searchByNameAndNumber(name, "");
  };

  return { searchByNameAndNumber, searchByName };
};
