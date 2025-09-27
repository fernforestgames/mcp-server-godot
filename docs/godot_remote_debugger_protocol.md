# Godot Remote Debugger Protocol

This document describes the wire protocol used by Godot's remote debugger for communication between a Godot game instance and an external debugger (typically the Godot editor).

## Overview

The Godot remote debugger uses a TCP-based protocol with binary message encoding. Messages are exchanged as Godot Variant Arrays, which are serialized using Godot's built-in variant encoding/decoding system.

## Connection and Transport

### Connection Setup
1. The debugger server (usually the Godot editor) listens on a TCP port (default: 6007)
2. The game instance connects to this port when remote debugging is enabled
3. Once connected, both sides can send and receive messages asynchronously

### Message Format
All messages follow this structure:
```
[4 bytes: Message Size][Message Data: Variant Array]
```

- **Message Size**: 32-bit unsigned integer (little-endian) indicating the size of the message data
- **Message Data**: A serialized Variant Array containing the actual message

### Message Structure
Each message is a Variant Array with exactly 3 elements:
```
[message_name, thread_id, data]
```

- **message_name** (String): The type/name of the message
- **thread_id** (int): The ID of the thread sending the message
- **data** (Array): Message-specific data payload

## Core Message Types

### Debug Control Messages

#### `debug_enter`
**Direction**: Game → Debugger
**Purpose**: Sent when the game hits a breakpoint or pauses execution

**Data Array Structure**:
```
[can_continue, error_message, has_stack_info, thread_id]
```
- `can_continue` (bool): Whether execution can be resumed
- `error_message` (String): Error message if this is an error breakpoint
- `has_stack_info` (bool): Whether stack information is available
- `thread_id` (int): ID of the thread that triggered the break

#### `debug_exit`
**Direction**: Game → Debugger
**Purpose**: Sent when debugging session ends

**Data Array Structure**: Empty array `[]`

#### `step`
**Direction**: Debugger → Game
**Purpose**: Execute one line and break again

**Data Array Structure**: Empty array `[]`

#### `next`
**Direction**: Debugger → Game
**Purpose**: Execute one line, stepping over function calls

**Data Array Structure**: Empty array `[]`

#### `continue`
**Direction**: Debugger → Game
**Purpose**: Resume execution

**Data Array Structure**: Empty array `[]`

#### `break`
**Direction**: Debugger → Game
**Purpose**: Force break execution

**Data Array Structure**: Empty array `[]`

### Stack Inspection Messages

#### `get_stack_dump`
**Direction**: Debugger → Game
**Purpose**: Request current call stack

**Data Array Structure**: Empty array `[]`

#### `stack_dump`
**Direction**: Game → Debugger
**Purpose**: Response with call stack information

**Data Array Structure**: Serialized `ScriptStackDump` object
```
[frame_count * 3, file1, line1, func1, file2, line2, func2, ...]
```

#### `get_stack_frame_vars`
**Direction**: Debugger → Game
**Purpose**: Request variables for a specific stack frame

**Data Array Structure**:
```
[frame_level]
```
- `frame_level` (int): The stack frame level (0 = current frame)

#### `stack_frame_vars`
**Direction**: Game → Debugger
**Purpose**: Response with variable count for a frame

**Data Array Structure**:
```
[total_variable_count]
```

#### `stack_frame_var`
**Direction**: Game → Debugger
**Purpose**: Information about a single variable

**Data Array Structure**: Serialized `ScriptStackVariable` object
```
[name, type, var_type, value]
```
- `name` (String): Variable name
- `type` (int): Variable scope type (0=local, 1=member, 2=global)
- `var_type` (int): Godot Variant type
- `value` (Variant): Variable value

### Breakpoint Management

#### `breakpoint`
**Direction**: Debugger → Game
**Purpose**: Add or remove a breakpoint

**Data Array Structure**:
```
[file_path, line_number, set]
```
- `file_path` (String): Path to the script file
- `line_number` (int): Line number for the breakpoint
- `set` (bool): true to set breakpoint, false to remove

#### `set_skip_breakpoints`
**Direction**: Debugger → Game
**Purpose**: Enable/disable breakpoint skipping

**Data Array Structure**:
```
[skip]
```
- `skip` (bool): Whether to skip breakpoints

#### `set_ignore_error_breaks`
**Direction**: Debugger → Game
**Purpose**: Enable/disable breaking on errors

**Data Array Structure**:
```
[ignore]
```
- `ignore` (bool): Whether to ignore error breakpoints

### Expression Evaluation

#### `evaluate`
**Direction**: Debugger → Game
**Purpose**: Evaluate an expression in the current debugging context

**Data Array Structure**:
```
[expression, frame_level]
```
- `expression` (String): The expression to evaluate
- `frame_level` (int): Stack frame level for evaluation context

#### `evaluation_return`
**Direction**: Game → Debugger
**Purpose**: Result of expression evaluation

**Data Array Structure**: Serialized `ScriptStackVariable` object
```
[expression, 3, var_type, result_value]
```

### Output and Error Messages

#### `output`
**Direction**: Game → Debugger
**Purpose**: Send print/log output

**Data Array Structure**:
```
[messages, types]
```
- `messages` (Array of Strings): The output messages
- `types` (Array of ints): Message types (0=LOG, 1=ERROR, 2=LOG_RICH)

#### `error`
**Direction**: Game → Debugger
**Purpose**: Send error information

**Data Array Structure**: Serialized `OutputError` object
```
[hour, minute, second, millisecond, source_file, source_func, source_line, error, error_description, is_warning, callstack_size, callstack_frames...]
```

### Script Management

#### `reload_scripts`
**Direction**: Debugger → Game
**Purpose**: Reload specific scripts

**Data Array Structure**:
```
[script_paths]
```
- `script_paths` (Array of Strings): Paths to scripts to reload

#### `reload_all_scripts`
**Direction**: Debugger → Game
**Purpose**: Reload all scripts

**Data Array Structure**: Empty array `[]`

## Profiler Messages

The debugger also supports profiler messages with the format:
```
profiler:profile_name
```

### Performance Profiler

#### `performance:profile_names`
**Direction**: Game → Debugger
**Purpose**: Send available performance monitor names

#### `performance:profile_frame`
**Direction**: Game → Debugger
**Purpose**: Send performance data for current frame

## Message Capture System

The protocol supports a capture system where messages can have prefixes separated by colons:
- `core:message_name` - Core debugger functionality
- `profiler:profile_name` - Profiler-specific messages
- Custom captures can be registered for extensions

## Rate Limiting and Flow Control

The protocol includes several rate limiting mechanisms:
- **max_chars_per_second**: Limits output message character count
- **max_errors_per_second**: Limits error message frequency
- **max_warnings_per_second**: Limits warning message frequency
- **max_queued_messages**: Limits total queued messages (default: 4096)

When limits are exceeded, overflow messages are sent to indicate dropped content.

## Error Handling

- Malformed messages are logged and ignored
- Connection drops are handled gracefully
- Recursive errors during message flushing are prevented
- Buffer overflows result in truncated content with overflow indicators

## Implementation Notes

- All message encoding/decoding uses Godot's Variant system
- Messages are processed in separate threads with mutex protection
- The protocol is designed to handle high-frequency debugging operations
- Maximum message size is 8 MiB (8,388,608 bytes)
- Connection polling occurs every 2048 script lines during execution

This protocol enables comprehensive debugging capabilities including breakpoint management, stack inspection, variable examination, expression evaluation, and real-time output monitoring.