import { Colord } from "colord";
import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { EventBus, GameEvent } from "../../../core/EventBus";
import { GameView, PlayerView, UnitView } from "../../../core/game/GameView";
import { ClientID } from "../../../core/Schemas";
import { renderNumber } from "../../Utils";
import { Layer } from "./Layer";

interface Entry {
  name: string;
  color: Colord;
  position: number;
  score: string;
  gold: string;
  troops: string;
  isMyPlayer: boolean;
  player: PlayerView;
}

export class GoToPlayerEvent implements GameEvent {
  constructor(public player: PlayerView) {}
}

export class GoToUnitEvent implements GameEvent {
  constructor(public unit: UnitView) {}
}

@customElement("leader-board")
export class Leaderboard extends LitElement implements Layer {
  public game: GameView;
  public clientID: ClientID;
  public eventBus: EventBus;

  players: Entry[] = [];

  @state()
  private _leaderboardHidden = true;
  private _shownOnInit = false;
  private showTopFive = true;

  init() {}

  tick() {
    if (!this._shownOnInit && !this.game.inSpawnPhase()) {
      this._shownOnInit = true;
      this.showLeaderboard();
      this.updateLeaderboard();
    }
    if (this._leaderboardHidden) {
      return;
    }

    if (this.game.ticks() % 10 == 0) {
      this.updateLeaderboard();
    }
  }

  private updateLeaderboard() {
    if (this.clientID == null) {
      return;
    }
    const myPlayer = this.game
      .playerViews()
      .find((p) => p.clientID() == this.clientID);

    const sorted = this.game
      .playerViews()
      .sort((a, b) => b.numTilesOwned() - a.numTilesOwned());

    const numTilesWithoutFallout =
      this.game.numLandTiles() - this.game.numTilesWithFallout();

    const playersToShow = this.showTopFive ? sorted.slice(0, 5) : sorted;

    this.players = playersToShow.map((player, index) => {
      let troops = player.troops() / 10;
      if (!player.isAlive()) {
        troops = 0;
      }
      return {
        name: player.displayName(),
        color: player.playerColor(),
        position: index + 1,
        score: formatPercentage(
          player.numTilesOwned() / numTilesWithoutFallout,
        ),
        gold: renderNumber(player.gold()),
        troops: renderNumber(troops),
        isMyPlayer: player == myPlayer,
        player: player,
      };
    });

    if (myPlayer != null && this.players.find((p) => p.isMyPlayer) == null) {
      let place = 0;
      for (const p of sorted) {
        place++;
        if (p == myPlayer) {
          break;
        }
      }

      let myPlayerTroops = myPlayer.troops() / 10;
      if (!myPlayer.isAlive()) {
        myPlayerTroops = 0;
      }
      this.players.pop();
      this.players.push({
        name: myPlayer.displayName(),
        color: myPlayer.playerColor(),
        position: place,
        score: formatPercentage(
          myPlayer.numTilesOwned() / this.game.numLandTiles(),
        ),
        gold: renderNumber(myPlayer.gold()),
        troops: renderNumber(myPlayerTroops),
        isMyPlayer: true,
        player: myPlayer,
      });
    }

    this.requestUpdate();
  }

  private handleRowClickPlayer(player: PlayerView) {
    this.eventBus.emit(new GoToPlayerEvent(player));
  }

  renderLayer(context: CanvasRenderingContext2D) {}
  shouldTransform(): boolean {
    return false;
  }

  static styles = css`
    :host {
      display: block;
    }
    img.emoji {
      height: 1em;
      width: auto;
    }
    .leaderboard {
      position: fixed;
      top: 10px;
      left: 10px;
      z-index: 9999;
      background-color: rgb(31 41 55 / 0.7);
      padding: 10px;
      padding-top: 0px;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
      border-radius: 10px;
      max-width: 500px;
      max-height: 30vh;
      overflow-y: auto;
      width: 400px;
      backdrop-filter: blur(5px);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 5px;
      text-align: center;
      border-bottom: 1px solid rgba(51, 51, 51, 0.2);
      color: white;
    }
    th {
      background-color: rgb(31 41 55 / 0.5);
      color: white;
    }
    .myPlayer {
      font-weight: bold;
      font-size: 1.2em;
    }
    .otherPlayer {
      font-size: 1em;
    }
    tr:nth-child(even) {
      background-color: rgb(31 41 55 / 0.5);
    }
    tbody tr {
      cursor: pointer;
      transition: background-color 0.2s;
    }
    tbody tr:hover {
      background-color: rgba(78, 78, 78, 0.8);
    }
    .hidden {
      display: none !important;
    }
    .leaderboard-button {
      position: fixed;
      left: 10px;
      top: 10px;
      z-index: 9999;
      background-color: rgb(31 41 55 / 0.7);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 5px 10px;
      cursor: pointer;
    }

    .leaderboard-close-button {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
    }

    .leaderboard-top-five-button {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
    }

    .player-name {
      max-width: 10ch;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .player-color {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .player-color > div {
      width: 12px;
      height: 12px;
      border: 1px solid rgba(0, 0, 0, 0.3);
      border-radius: 2px;
      flex-shrink: 0;
    }

    @media (max-width: 1000px) {
      .leaderboard {
        top: 70px;
        left: 0px;
      }

      .leaderboard-button {
        left: 0px;
        top: 52px;
      }
    }
  `;

  render() {
    return html`
      <button
        @click=${() => this.toggleLeaderboard()}
        class="leaderboard-button ${this._shownOnInit && this._leaderboardHidden
          ? ""
          : "hidden"}"
      >
        Leaderboard
      </button>
      <div
        class="leaderboard ${this._leaderboardHidden ? "hidden" : ""}"
        @contextmenu=${(e) => e.preventDefault()}
      >
        <button
          class="leaderboard-close-button"
          @click=${() => this.hideLeaderboard()}
        >
          Hide
        </button>
        <button
          class="leaderboard-top-five-button"
          @click=${() => {
            this.showTopFive = !this.showTopFive;
            this.updateLeaderboard();
          }}
        >
          ${this.showTopFive ? "Show All" : "Show Top 5"}
        </button>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Owned</th>
              <th>Gold</th>
              <th>Troops</th>
            </tr>
          </thead>
          <tbody>
            ${this.players.map(
              (player) => html`
                <tr
                  class="${player.isMyPlayer ? "myPlayer" : "otherPlayer"}"
                  @click=${() => this.handleRowClickPlayer(player.player)}
                >
                  <td>${player.position}</td>
                  <td class="player-name">
                    <div class="player-color">
                      <div
                        style="background-color: ${player.color?.toRgbString()};"
                      ></div>
                      ${unsafeHTML(player.name)}
                    </div>
                  </td>
                  <td>${player.score}</td>
                  <td>${player.gold}</td>
                  <td>${player.troops}</td>
                </tr>
              `,
            )}
          </tbody>
        </table>
      </div>
    `;
  }

  toggleLeaderboard() {
    this._leaderboardHidden = !this._leaderboardHidden;
    this.requestUpdate();
  }

  hideLeaderboard() {
    this._leaderboardHidden = true;
    this.requestUpdate();
  }

  showLeaderboard() {
    this._leaderboardHidden = false;
    this.requestUpdate();
  }

  get isVisible() {
    return !this._leaderboardHidden;
  }
}

function formatPercentage(value: number): string {
  const perc = value * 100;
  if (perc > 99.5) {
    return "100%";
  }
  if (perc < 0.01) {
    return "0%";
  }
  if (perc < 0.1) {
    return perc.toPrecision(1) + "%";
  }
  return perc.toPrecision(2) + "%";
}
