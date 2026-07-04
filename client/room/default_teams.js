// Команды режима "Заражение: Нулевой Пациент"
import { Color } from 'pixel_combats/basic';
import { Teams } from 'pixel_combats/room';

export const SURVIVORS_NAME = "Survivors";
export const ZOMBIES_NAME = "Zombies";
export const SURVIVORS_DISPLAY_NAME = "Teams/Survivors";
export const ZOMBIES_DISPLAY_NAME = "Teams/Zombies";
export const SURVIVORS_SPAWN_GROUP = 1;
export const ZOMBIES_SPAWN_GROUP = 2;

export function create_survivors() {
    Teams.Add(SURVIVORS_NAME, SURVIVORS_DISPLAY_NAME, new Color(0.2, 0.6, 1, 0));
    const team = Teams.Get(SURVIVORS_NAME);
    team.Spawns.SpawnPointsGroups.Add(SURVIVORS_SPAWN_GROUP);
    return team;
}

export function create_zombies() {
    Teams.Add(ZOMBIES_NAME, ZOMBIES_DISPLAY_NAME, new Color(0.4, 0.8, 0.1, 0));
    const team = Teams.Get(ZOMBIES_NAME);
    team.Spawns.SpawnPointsGroups.Add(ZOMBIES_SPAWN_GROUP);
    return team;
}
