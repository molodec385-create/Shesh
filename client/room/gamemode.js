import { DisplayValueHeader } from 'pixel_combats/basic';
import * as room_lib from 'pixel_combats/room';
const {
    room, Game, Players, Inventory, LeaderBoard, Teams, Damage,
    BreackGraph, Ui, Properties, GameMode, Spawns, Timers
} = room_lib;

import * as teams from './default_teams.js';

room.PopupsEnable = true;

// ==================== НАСТРОЙКИ ====================
const WAITING_TIME = 10;          // ожидание игроков
const INFECTION_TIME = 240;       // 4 минуты основной фазы
const END_TIME = 15;              // финальный экран

const REGULAR_ZOMBIE_HP = 150;
const REGULAR_ZOMBIE_JUMP_BOOST = 1.2; // +20%
const ALPHA_JUMP_BOOST = 1.5;          // +50%
const ALPHA_SPEED_BOOST = 1.3;         // +30%
const LAST_SURVIVOR_SPEED_BOOST = 1.25; // +25% (в диапазоне 20-30%, указанном в ТЗ)

const SURVIVE_TICK_SCORE = 10;     // очки за тик выживания
const SURVIVE_TICK_INTERVAL = 15;  // секунд
const KILL_REGULAR_ZOMBIE_SCORE = 50;
const INFECTION_SCORE = 150;       // очки зомби за заражение человека

// имена состояний
const WaitingState = "Waiting";
const WarmupState = "Warmup";
const InfectionState = "Infection";
const EndState = "End";

const IS_ALPHA_PROP = "IsAlpha";
const ALIVE_COUNT_PROP = "AliveCount";

// ==================== ПАРАМЕТРЫ РЕЖИМА ====================
function parseWarmupTime() {
    const v = GameMode.Parameters.Get("WarmupTime");
    switch (v) {
        case "Warmup_20": return 20;
        case "Warmup_45": return 45;
        default: return 30;
    }
}

function parseAlphaHP() {
    const v = GameMode.Parameters.Get("AlphaHP");
    switch (v) {
        case "HP_400": return 400;
        case "HP_800": return 800;
        default: return 600;
    }
}

const WarmupTime = parseWarmupTime();
const AlphaHP = parseAlphaHP();

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
const stateProp = Properties.GetContext().Get("State");
const mainTimer = Timers.GetContext().Get("Main");
const scoresTimer = Timers.GetContext().Get("Scores");

Properties.GetContext().GameModeName.Value = "GameModes/Outbreak";

const survivors = teams.create_survivors();
const zombies = teams.create_zombies();

survivors.Properties.Get(ALIVE_COUNT_PROP).Value = 0;
zombies.Properties.Get(ALIVE_COUNT_PROP).Value = 0;

// верхняя панель: живые люди / зомби
Ui.GetContext().TeamProp1.Value = { Team: teams.SURVIVORS_NAME, Prop: ALIVE_COUNT_PROP };
Ui.GetContext().TeamProp2.Value = { Team: teams.ZOMBIES_NAME, Prop: ALIVE_COUNT_PROP };

Ui.GetContext().MainTimerId.Value = mainTimer.Id;

// лидерборд
LeaderBoard.PlayerLeaderBoardValues = [
    new DisplayValueHeader("Scores", "Statistics/Scores", "Statistics/ScoresShort")
];
LeaderBoard.PlayersWeightGetter.Set(function (player) {
    return player.Properties.Get("Scores").Value;
});

// вход в команду по запросу (доступно только пока идёт Waiting/Warmup — люди)
Teams.OnRequestJoinTeam.Add(function (player, team) {
    // не даём вручную вступить в зомби на старте — все начинают выжившими
    if (stateProp.Value === WaitingState || stateProp.Value === WarmupState) {
        survivors.Add(player);
    } else {
        team.Add(player);
    }
});

Teams.OnPlayerChangeTeam.Add(function (player) {
    player.Spawns.Spawn();
    updateAliveCounters();

    if (player.Team === teams_ref(zombies)) {
        // применяем параметры зомби при входе в команду
        applyZombieLoadout(player, false);
    } else if (player.Team === teams_ref(survivors)) {
        applySurvivorLoadout(player);
    }
});

// вспомогательная функция сравнения (на случай если Team - обёртка объекта)
function teams_ref(team) { return team; }

Players.OnPlayerDisconnected.Add(function (player) {
    updateAliveCounters();
});

// ==================== ЭКИПИРОВКА ====================
function applySurvivorLoadout(player) {
    const inv = player.Inventory;
    inv.Main.Value = true;
    inv.Secondary.Value = true;
    inv.Melee.Value = false;
    inv.Explosive.Value = false;
    inv.Build.Value = true;
    inv.BuildInfinity.Value = false; // стандартный (конечный) лимит блоков движка
    inv.MainInfinity.Value = false;
    inv.SecondaryInfinity.Value = false;

    // ВАЖНО: имя свойства HP подтверждено документацией (contextedProperties.MaxHp).
    // Имена свойств скорости/прыжка НЕ подтверждены в переданных материалах —
    // ниже используется предположительное имя, проверьте его в редакторе режима
    // (автодополнение по player.ContextedProperties.) и поправьте при необходимости.
    player.ContextedProperties.MaxHp.Value = 100;
    // player.ContextedProperties.MoveSpeed.Value = 1.0; // TODO: проверить точное имя
    // player.ContextedProperties.JumpHeight.Value = 1.0; // TODO: проверить точное имя

    player.Properties.Get(IS_ALPHA_PROP).Value = 0;
}

function applyZombieLoadout(player, isAlpha) {
    const inv = player.Inventory;
    inv.Main.Value = false;
    inv.Secondary.Value = false;
    inv.Melee.Value = true;
    inv.Explosive.Value = false;
    inv.Build.Value = false;

    if (isAlpha) {
        player.ContextedProperties.MaxHp.Value = AlphaHP;
        // TODO: проверить точные имена свойств скорости/прыжка в редакторе
        // player.ContextedProperties.MoveSpeed.Value = ALPHA_SPEED_BOOST;
        // player.ContextedProperties.JumpHeight.Value = ALPHA_JUMP_BOOST;
        player.Properties.Get(IS_ALPHA_PROP).Value = 1;
        player.PopUp("PopUp/AlphaAssigned");
        Ui.GetContext().Hint.Value = "Hint/AlphaAppeared";
    } else {
        player.ContextedProperties.MaxHp.Value = REGULAR_ZOMBIE_HP;
        // player.ContextedProperties.JumpHeight.Value = REGULAR_ZOMBIE_JUMP_BOOST; // TODO
        player.Properties.Get(IS_ALPHA_PROP).Value = 0;
    }
}

// ==================== СЧЁТЧИКИ ЖИВЫХ ====================
function updateAliveCounters() {
    survivors.Properties.Get(ALIVE_COUNT_PROP).Value = survivors.Players.length;
    zombies.Properties.Get(ALIVE_COUNT_PROP).Value = zombies.Players.length;
    checkLastSurvivor();
    checkWinConditions();
}

// ==================== ПОСЛЕДНИЙ ВЫЖИВШИЙ ====================
let lastSurvivorBuffApplied = false;

function checkLastSurvivor() {
    if (stateProp.Value !== InfectionState) return;
    if (survivors.Players.length === 1 && !lastSurvivorBuffApplied) {
        lastSurvivorBuffApplied = true;
        const player = survivors.Players[0];
        player.PopUp("PopUp/LastSurvivor");
        player.Inventory.MainInfinity.Value = true;
        player.Inventory.SecondaryInfinity.Value = true;
        // TODO: проверить точное имя свойства скорости
        // player.ContextedProperties.MoveSpeed.Value = LAST_SURVIVOR_SPEED_BOOST;
    }
    if (survivors.Players.length !== 1) {
        lastSurvivorBuffApplied = false;
    }
}

// ==================== ЗАРАЖЕНИЕ ПРИ СМЕРТИ ====================
Damage.OnDeath.Add(function (player) {
    if (stateProp.Value !== InfectionState) return;

    if (player.Team === teams_ref(survivors)) {
        // человек погиб — превращаем в обычного зомби
        zombies.Add(player);
        // очки зомби, который заразил — начисляем через OnKill ниже
    }
});

Damage.OnKill.Add(function (killer, killed) {
    if (stateProp.Value !== InfectionState) return;
    if (!killer || !killed) return;

    if (killer.Team === teams_ref(zombies) && killed.Team === teams_ref(survivors)) {
        // зомби заразил человека
        killer.Properties.Get("Scores").Value += INFECTION_SCORE;
    }

    if (killer.Team === teams_ref(survivors) && killed.Team === teams_ref(zombies)) {
        const isAlpha = killed.Properties.Get(IS_ALPHA_PROP).Value === 1;
        if (isAlpha) {
            // убийство Альфы — досрочная победа выживших
            SetEndOfMatch(survivors);
        } else {
            killer.Properties.Get("Scores").Value += KILL_REGULAR_ZOMBIE_SCORE;
        }
    }
});

// ==================== ПРОВЕРКА ПОБЕДЫ ====================
function checkWinConditions() {
    if (stateProp.Value !== InfectionState) return;
    if (survivors.Players.length === 0) {
        SetEndOfMatch(zombies);
    }
}

// ==================== ТИК ОЧКОВ ЗА ВЫЖИВАНИЕ ====================
scoresTimer.OnTimer.Add(function () {
    if (stateProp.Value !== InfectionState) return;
    for (const player of survivors.Players) {
        player.Properties.Get("Scores").Value += SURVIVE_TICK_SCORE;
    }
});

// ==================== ФАЗЫ МАТЧА ====================
mainTimer.OnTimer.Add(function () {
    switch (stateProp.Value) {
        case WaitingState:
            SetWarmup();
            break;
        case WarmupState:
            SetInfection();
            break;
        case InfectionState:
            // время вышло — люди выжили
            SetEndOfMatch(survivors);
            break;
        case EndState:
            Game.RestartGame();
            break;
    }
});

function SetWaiting() {
    stateProp.Value = WaitingState;
    Ui.GetContext().Hint.Value = "Hint/WaitingPlayers";
    Spawns.GetContext().enable = false;
    Damage.GetContext().DamageOut.Value = false;
    mainTimer.Restart(WAITING_TIME);
}

function SetWarmup() {
    stateProp.Value = WarmupState;
    Ui.GetContext().Hint.Value = "Hint/Warmup";
    Damage.GetContext().DamageOut.Value = false;
    Spawns.GetContext().RespawnTime.Value = 2;
    Spawns.GetContext().enable = true;

    // все игроки — выжившие на старте
    for (const player of Players.All) {
        if (player.Team !== teams_ref(survivors)) {
            survivors.Add(player);
        } else {
            applySurvivorLoadout(player);
        }
    }
    Spawns.GetContext(survivors).Spawn();

    mainTimer.Restart(WarmupTime);
}

function SetInfection() {
    stateProp.Value = InfectionState;
    Damage.GetContext().DamageOut.Value = true;

    // выбираем случайного Нулевого Пациента среди выживших
    const pool = survivors.Players;
    if (pool.length > 0) {
        const alpha = pool[Math.floor(Math.random() * pool.length)];
        zombies.Add(alpha);
        applyZombieLoadout(alpha, true);
        alpha.Spawns.Spawn();
    }

    Ui.GetContext().Hint.Value = "Hint/Infection";
    updateAliveCounters();
    scoresTimer.RestartLoop(SURVIVE_TICK_INTERVAL);
    mainTimer.Restart(INFECTION_TIME);
}

function SetEndOfMatch(winnerTeam) {
    if (stateProp.Value === EndState) return; // защита от повторного вызова
    stateProp.Value = EndState;
    scoresTimer.Stop();
    Ui.GetContext().Hint.Value = "Hint/EndOfMatch";
    Spawns.GetContext().enable = false;
    Damage.GetContext().DamageOut.Value = false;
    Game.GameOver(winnerTeam);
    mainTimer.Restart(END_TIME);
}

// старт режима
SetWaiting();
