import { DisplayValueHeader } from 'pixel_combats/basic';
import * as room_lib from 'pixel_combats/room';
const { room, Game, Players, Inventory, LeaderBoard, Teams, Damage, Ui, Properties, GameMode, Spawns, Timers, ScoreInfo } = room_lib;

import * as teams from './default_teams.js';

// Включаем попапы
room.PopupsEnable = true;

// Константы времени матча в зависимости от GameLength
const MATCH_TIMES = {
    'S': 180,  // 3 минуты
    'M': 240,  // 4 минуты
    'L': 300,  // 5 минут
    'XL': 360  // 6 минут
};

// Константы очков
const BASE_KILL_SCORE = 100;
const BOUNTY_INCREMENT = 50; // На сколько растёт награда за каждый килл в серии

// Кастомные свойства для отслеживания серий (Bounty)
const STREAK_PROP = "BountyStreak";
const SCORES_PROP = "Scores";
const KILLS_PROP = "Kills";

// Таймеры и свойства комнаты
const mainTimer = Timers.GetContext().Get("Main");
const gameState = Properties.GetContext().Get("State");

// 1. Инициализация UI и базовых настроек режима
Ui.ScoresTopViewEnable = true; // Включаем вылетающие циферки очков над прицелом!
Ui.GetContext().MainTimerId.Value = mainTimer.Id;

// Настройка лидерборда по API 2.0
LeaderBoard.PlayerLeaderBoardValues = [
    new DisplayValueHeader(KILLS_PROP, "Bounty/Kill", "Bounty/KillShort"),
    new DisplayValueHeader(STREAK_PROP, "Bounty/Streak", "Bounty/StreakShort"),
    new DisplayValueHeader(SCORES_PROP, "Bounty/Score", "Bounty/ScoreShort")
];
LeaderBoard.TeamLeaderBoardValue = new DisplayValueHeader(SCORES_PROP, "Bounty/Score", "Bounty/Score");

LeaderBoard.PlayersWeightGetter.Set(function(player) { return player.Properties.Get(SCORES_PROP).Value; });
LeaderBoard.TeamWeightGetter.Set(function(team) { return team.Properties.Get(SCORES_PROP).Value; });

// Создаём команды
teams.create_teams();
const blueTeam = Teams.Get(teams.BLUE_TEAM_NAME);
const redTeam = Teams.Get(teams.RED_TEAM_NAME);

// Выводим счёт команд в топ UI
Ui.GetContext().TeamProp1.Value = { Team: "Blue", Prop: SCORES_PROP };
Ui.GetContext().TeamProp2.Value = { Team: "Red", Prop: SCORES_PROP };

// Применяем параметры админки комнаты
Damage.GetContext().FriendlyFire.Value = GameMode.Parameters.GetBool("FriendlyFire");

// 2. Логика спавна и инвентаря
Teams.OnRequestJoinTeam.Add(function(player, team) { team.Add(player); });
Teams.OnPlayerChangeTeam.Add(function(player) { 
    player.Properties.Get(STREAK_PROP).Value = 0; // Сброс награды при входе
    player.Spawns.Spawn(); 
});

Spawns.GetContext().OnSpawn.Add(function(player) {
    player.Properties.Immortality.Value = true;
    player.Timers.Get("spawn_immortal").Restart(3); // 3 секунды защиты
});

Timers.OnPlayerTimer.Add(function(timer) {
    if (timer.Id === "spawn_immortal") timer.Player.Properties.Immortality.Value = false;
});

// 3. Обработка убийств и механика Bounty
Damage.OnKillReport.Add(function(victim, killer, report) {
    if (gameState.Value !== "Battle") return;
    if (!killer || !victim || killer.Team == null || victim.Team == null) return;
    
    // Огонь по своим не приносит очков
    if (killer.Team === victim.Team) return;

    // Читаем текущие показатели жертвы и убийцы
    const victimStreak = victim.Properties.Get(STREAK_PROP).Value;
    let killerStreak = killer.Properties.Get(STREAK_PROP).Value;

    // Считаем награду: базовые очки + накопленный Bounty с головы жертвы
    const totalReward = BASE_KILL_SCORE + (victimStreak * BOUNTY_INCREMENT);

    // Начисляем очки убийце и его команде
    killer.Properties.Get(SCORES_PROP).Value += totalReward;
    ++killer.Properties.Get(KILLS_PROP).Value;
    
    if (killer.Team.Properties.Get(SCORES_PROP)) {
        killer.Team.Properties.Get(SCORES_PROP).Value += Math.round(totalReward * 0.1); // 10% в общий зачёт команды
    }

    // Увеличиваем серию убийцы (награда за его голову растёт)
    killerStreak += 1;
    killer.Properties.Get(STREAK_PROP).Value = killerStreak;

    // Показываем вылетающий счёт над прицелом через ScoreInfo
    ScoreInfo.Show(killer, {
        Type: 2, // Тип Kill
        WeaponId: report.KillHit ? report.KillHit.WeaponID : 0,
        Scores: totalReward,
        IsHeadshot: !!(report.KillHit && report.KillHit.IsHeadShot === true)
    });

    // Оповещаем комнату, если прервана большая серия
    if (victimStreak >= 3) {
        Players.All.PopUp("Охотник " + killer.Name + " ликвидировал лидера " + victim.Name + " и забрал " + totalReward + " очков!");
    }

    // Обнуляем серию погибшего
    victim.Properties.Get(STREAK_PROP).Value = 0;
});

// Автоматический респавн
Damage.OnDeath.Add(function(player) {
    Spawns.GetContext(player).Spawn();
});

// 4. Машина состояний матча
mainTimer.OnTimer.Add(function() {
    switch (gameState.Value) {
        case "Waiting":
            start_battle();
            break;
        case "Battle":
            end_match();
            break;
        case "End":
            Game.RestartGame();
            break;
    }
});

// Стартовое состояние
set_waiting();

function set_waiting() {
    gameState.Value = "Waiting";
    Ui.GetContext().Hint.Value = "Hint/Waiting";
    Spawns.GetContext().enable = false;
    mainTimer.Restart(10); // 10 секунд на сбор игроков
}

function start_battle() {
    gameState.Value = "Battle";
    Ui.GetContext().Hint.Value = "Hint/Battle";
    Spawns.GetContext().enable = true;

    // Конфигурация оружия
    const inv = Inventory.GetContext();
    const onlyKnives = GameMode.Parameters.GetBool("OnlyKnives");
    
    inv.Main.Value = !onlyKnives;
    inv.Secondary.Value = !onlyKnives;
    inv.Melee.Value = true;
    inv.Explosive.Value = !onlyKnives;
    inv.Build.Value = true;

    // Обнуляем очки перед боем
    blueTeam.Properties.Get(SCORES_PROP).Value = 0;
    redTeam.Properties.Get(SCORES_PROP).Value = 0;

    // Определяем время матча
    const len = GameMode.Parameters.GameLength;
    const duration = MATCH_TIMES[len] || MATCH_TIMES['M'];
    mainTimer.Restart(duration);

    // Спавним команды
    for (const team of Teams) Spawns.GetContext(team).Spawn();
}

function end_match() {
    gameState.Value = "End";
    Ui.GetContext().Hint.Value = "Hint/End";
    Spawns.GetContext().Despawn();
    Spawns.GetContext().enable = false;

    // Передаем массив команд в GameOver для автоматического распределения мест
    Game.GameOver(LeaderBoard.GetTeams());
    mainTimer.Restart(10); // 10 секунд экрана конца игры
}
