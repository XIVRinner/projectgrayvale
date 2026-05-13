import {
  type ServerChatCommandView,
  type ServerModerationRequest,
} from "./server-chat.models";

export const SERVER_CHAT_COMMANDS: readonly ServerChatCommandView[] = [
  {
    id: "help",
    trigger: "/help",
    label: "Help",
    description: "Show the chat commands available in this relay.",
    keywords: ["commands", "guide", "support"],
  },
  {
    id: "who",
    trigger: "/who",
    label: "Who",
    description: "Refresh the online player list and recent chat traffic.",
    keywords: ["players", "online", "refresh"],
  },
  {
    id: "server",
    trigger: "/server",
    label: "Server Select",
    description: "Open server selection and connection controls.",
    keywords: ["connect", "shard", "select"],
  },
  {
    id: "admin",
    trigger: "/admin",
    label: "Grant Admin",
    description: "Open the admin password prompt for this shard.",
    keywords: ["moderation", "rank", "password"],
  },
  {
    id: "timeout",
    trigger: "/timeout",
    label: "Timeout",
    description:
      'Timeout a player from chat. Syntax: /timeout "Player Name" 15 reason',
    keywords: ["mute", "moderation", "minutes", "reason"],
  },
  {
    id: "ban",
    trigger: "/ban",
    label: "Chat Ban",
    description:
      'Ban a player from chat. Syntax: /ban "Player Name" reason',
    keywords: ["moderation", "revoke", "reason"],
  },
  {
    id: "serverban",
    trigger: "/serverban",
    label: "Server Ban",
    description:
      'Ban a player from chat and server entry. Syntax: /serverban "Player Name" reason',
    keywords: ["moderation", "block", "entry", "reason"],
  },
  {
    id: "clear",
    trigger: "/clear",
    label: "Lift Restrictions",
    description:
      'Lift chat restrictions for a player. Syntax: /clear "Player Name"',
    keywords: ["unmute", "unban", "moderation", "restore"],
  },
  {
    id: "join-channel",
    trigger: "/join",
    label: "Join Channel",
    description: "Join or create a custom channel. Syntax: /join channel_name",
    keywords: ["channel", "custom", "social"],
  },
  {
    id: "leave-channel",
    trigger: "/leave",
    label: "Leave Channel",
    description: "Leave a custom channel. Syntax: /leave channel_name",
    keywords: ["channel", "custom", "social"],
  },
  {
    id: "whisper",
    trigger: "/whisper",
    label: "Whisper",
    description: "Direct message another character. Syntax: /whisper \"Name\" message",
    keywords: ["dm", "tell", "w", "direct"],
  },
  {
    id: "tell",
    trigger: "/tell",
    label: "Tell",
    description: "Alias of whisper. Syntax: /tell \"Name\" message",
    keywords: ["dm", "whisper", "w", "direct"],
  },
  {
    id: "friend-add",
    trigger: "/friend add",
    label: "Add Friend",
    description:
      "Add a friend by character or profile name. Syntax: /friend add name",
    keywords: ["friend", "social", "profile"],
  },
  {
    id: "guild-invite",
    trigger: "/guild invite",
    label: "Guild Invite",
    description: "Invite a character to guild. Syntax: /guild invite \"Name\"",
    keywords: ["guild", "invite", "social"],
  },
] as const;

export interface ParsedServerModerationCommand {
  readonly targetQuery: string;
  readonly request: ServerModerationRequest;
  readonly usage: string;
}

export function resolveServerChatCommand(
  message: string,
): ServerChatCommandView | null {
  const normalized = message.trim().toLowerCase();

  return (
    SERVER_CHAT_COMMANDS.find(
      (command) => normalized === command.trigger.toLowerCase(),
    ) ?? null
  );
}

export function resolveServerModerationCommand(
  message: string,
): ParsedServerModerationCommand | null {
  const tokens = tokenizeChatInput(message.trim());

  if (tokens.length === 0) {
    return null;
  }

  const [command, ...args] = tokens;
  const normalized = command.toLowerCase();

  if (normalized === "/timeout") {
    if (args.length < 3) {
      return {
        targetQuery: "",
        request: {
          action: "timeout",
          targetUuid: "",
          durationMinutes: undefined,
          reason: undefined,
        },
        usage: 'Usage: /timeout "Player Name" 15 reason',
      };
    }

    const durationMinutes = Number.parseInt(args[1] ?? "", 10);
    return {
      targetQuery: args[0] ?? "",
      request: {
        action: "timeout",
        targetUuid: "",
        durationMinutes: Number.isInteger(durationMinutes)
          ? durationMinutes
          : undefined,
        reason: args.slice(2).join(" ").trim() || undefined,
      },
      usage: 'Usage: /timeout "Player Name" 15 reason',
    };
  }

  if (normalized === "/ban" || normalized === "/serverban") {
    if (args.length < 2) {
      return {
        targetQuery: "",
        request: {
          action: "ban",
          targetUuid: "",
          reason: undefined,
          blockServerEntry: normalized === "/serverban",
        },
        usage:
          normalized === "/serverban"
            ? 'Usage: /serverban "Player Name" reason'
            : 'Usage: /ban "Player Name" reason',
      };
    }

    return {
      targetQuery: args[0] ?? "",
      request: {
        action: "ban",
        targetUuid: "",
        reason: args.slice(1).join(" ").trim() || undefined,
        blockServerEntry: normalized === "/serverban",
      },
      usage:
        normalized === "/serverban"
          ? 'Usage: /serverban "Player Name" reason'
          : 'Usage: /ban "Player Name" reason',
    };
  }

  if (normalized === "/clear") {
    if (args.length < 1) {
      return {
        targetQuery: "",
        request: {
          action: "clear",
          targetUuid: "",
        },
        usage: 'Usage: /clear "Player Name"',
      };
    }

    return {
      targetQuery: args[0] ?? "",
      request: {
        action: "clear",
        targetUuid: "",
      },
      usage: 'Usage: /clear "Player Name"',
    };
  }

  return null;
}

export function formatServerChatHelp(): string {
  return SERVER_CHAT_COMMANDS.map(
    (command) => `${command.trigger} - ${command.description}`,
  ).join(" | ");
}

function tokenizeChatInput(message: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]+)"|(\S+)/g;

  let match: RegExpExecArray | null = pattern.exec(message);

  while (match) {
    const quoted = match[1]?.trim();
    const plain = match[2]?.trim();

    if (quoted) {
      tokens.push(quoted);
    } else if (plain) {
      tokens.push(plain);
    }

    match = pattern.exec(message);
  }

  return tokens;
}
