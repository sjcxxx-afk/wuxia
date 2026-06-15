import { loadData, updateData } from "../storage/jsonStore";
import type { Profile } from "../types";

export const profileRepository = {
  async get(): Promise<Profile> {
    const data = await loadData();
    return {
      nickname: data.profile.nickname ?? "",
      avatarUrl: data.profile.avatarUrl ?? null,
    };
  },

  async update(profile: { nickname?: string; avatarUrl?: string | null }): Promise<void> {
    updateData((data) => ({
      ...data,
      profile: {
        ...data.profile,
        ...(profile.nickname !== undefined && { nickname: profile.nickname }),
        ...(profile.avatarUrl !== undefined && { avatarUrl: profile.avatarUrl }),
      },
    }));
  },
};