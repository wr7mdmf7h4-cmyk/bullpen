import type { Metadata } from "next";
import { ProfileForm } from "@/components/profile/profile-form";
import { ACHIEVEMENTS } from "@/domain/achievements";
import { ACCENTS, parseAvatar, type AccentId } from "@/domain/profile";
import { db } from "@/server/db";
import { requireUser } from "@/server/users";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const user = await requireUser("/profile/edit");
  const unlocked = await db.userAchievement.findMany({ where: { userId: user.id }, select: { achievementKey: true } });
  const unlockedKeys = new Set(unlocked.map((a) => a.achievementKey));
  const badges = ACHIEVEMENTS.filter((a) => unlockedKeys.has(a.key)).map(({ key, name, emoji }) => ({
    key,
    name,
    emoji,
  }));
  const avatar = parseAvatar(user.avatarSeed);
  // Old accounts used their username as the seed; keep that face until they shuffle.
  const seed = /^[A-Za-z0-9_-]{1,64}$/.test(avatar.seed) ? avatar.seed : user.username;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-8">
      <header className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Edit profile</h1>
        <p className="text-sm text-muted-foreground">Everything here is visible to other players.</p>
      </header>
      <ProfileForm
        username={user.username}
        badges={badges}
        initial={{
          displayName: user.displayName ?? "",
          bio: user.bio ?? "",
          avatarStyle: avatar.style,
          avatarSeed: seed,
          accentColor: ACCENTS.some((a) => a.id === user.accentColor) ? (user.accentColor as AccentId) : null,
          favoriteSymbol: user.favoriteSymbol ?? "",
          featuredBadge: user.featuredBadge && unlockedKeys.has(user.featuredBadge) ? user.featuredBadge : null,
        }}
      />
    </div>
  );
}
