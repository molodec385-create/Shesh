var KNIFE_PLAYER_ID = "8C324BCA8B5AC74D";

var damageEnabled      = GameMode.Parameters.GetBool("Damage");
var partialDestruction = GameMode.Parameters.GetBool("PartialDesruction");
var loosenBlocks       = GameMode.Parameters.GetBool("LoosenBlocks");
var redTeamEnabled     = GameMode.Parameters.GetBool("RedTeam");
var blueTeamEnabled    = GameMode.Parameters.GetBool("BlueTeam");
var blueHasNothing     = GameMode.Parameters.GetBool("BlueHasNothing");
var floodFill          = GameMode.Parameters.GetBool("FloodFill");
var fillQuad           = GameMode.Parameters.GetBool("FillQuad");
var removeQuad         = GameMode.Parameters.GetBool("RemoveQuad");
var flyEnabled         = GameMode.Parameters.GetBool("Fly");

Damage.GetContext().DamageOut.Value    = damageEnabled;
Damage.GetContext().FriendlyFire.Value = false;

BreackGraph.WeakBlocks.Value          = loosenBlocks;
BreackGraph.OnlyPlayerBlocksDmg.Value = partialDestruction;

var roomInv = Inventory.GetContext();
roomInv.Main.Value          = false;
roomInv.Secondary.Value     = false;
roomInv.Melee.Value         = false;
roomInv.Explosive.Value     = false;
roomInv.Build.Value         = true;
roomInv.BuildInfinity.Value = true;
roomInv.FloodFill.Value     = floodFill;
roomInv.FillQuad.Value      = fillQuad;
roomInv.RemoveQuad.Value    = removeQuad;

Spawns.GetContext().FlyEnabled.Value = flyEnabled;

if (redTeamEnabled) {
    Teams.Add("Red", "Teams/Red", { r: 1 });
    Teams.Get("Red").Spawns.SpawnPointsGroups.Add(1);
}

if (blueTeamEnabled) {
    Teams.Add("Blue", "Teams/Blue", { b: 1 });
    Teams.Get("Blue").Spawns.SpawnPointsGroups.Add(2);

    if (blueHasNothing) {
        var blueInv = Teams.Get("Blue").Inventory;
        blueInv.Build.Value         = false;
        blueInv.BuildInfinity.Value = false;
        blueInv.FloodFill.Value     = false;
        blueInv.FillQuad.Value      = false;
        blueInv.RemoveQuad.Value    = false;
    }
}

Teams.OnRequestJoinTeam.Add(function(player, team) {
    team.Add(player);
});

Teams.OnPlayerChangeTeam.Add(function(player) {
    player.Spawns.Spawn();
});

Spawns.GetContext().OnSpawn.Add(function(player) {
    if (player.UserId === KNIFE_PLAYER_ID) {
        player.Inventory.Melee.Value = true;
    }
});

Ui.GetContext().Hint.Value = "Hint/Build";
