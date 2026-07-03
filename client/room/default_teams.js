import { Color } from 'pixel_combats/basic';
import { Teams } from 'pixel_combats/room';

export const RED_TEAM_NAME = "Red";
export const BLUE_TEAM_NAME = "Blue";

export function create_teams() {
    // Синяя команда
    Teams.Add(BLUE_TEAM_NAME, "Teams/Blue", new Color(0, 0, 1, 0));
    const blue = Teams.Get(BLUE_TEAM_NAME);
    blue.Spawns.SpawnPointsGroups.Add(1);

    // Красная команда
    Teams.Add(RED_TEAM_NAME, "Teams/Red", new Color(1, 0, 0, 0));
    const red = Teams.Get(RED_TEAM_NAME);
    red.Spawns.SpawnPointsGroups.Add(2);
}
