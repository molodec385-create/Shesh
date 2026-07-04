import { Teams, Spawns, Ui } from 'pixel_combats/room';
import { Color } from 'pixel_combats/basic';

Teams.OnRequestJoinTeam.Add(function(player, team) { team.Add(player); });
Teams.OnPlayerChangeTeam.Add(function(player) { player.Spawns.Spawn(); });

Teams.Add("Blue", "Teams/Blue", new Color(0, 0, 1, 0));
Teams.Add("Red", "Teams/Red", new Color(1, 0, 0, 0));
Teams.Get("Blue").Spawns.SpawnPointsGroups.Add(1);
Teams.Get("Red").Spawns.SpawnPointsGroups.Add(2);

Spawns.GetContext().RespawnTime.Value = 0;

Ui.GetContext().Hint.Value = "Hint/AttackEnemies";
