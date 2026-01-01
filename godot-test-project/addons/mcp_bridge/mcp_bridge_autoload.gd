extends Node
## MCP Bridge Autoload
## Runs in the game and handles stdin/stdout communication with the MCP server

var _commands: MCPCommands
var _stdin_thread: Thread
var _running := false
var _message_queue: Array[Dictionary] = []
var _queue_mutex: Mutex


func _ready() -> void:
	# Only activate in debug builds when launched with --mcp-bridge flag
	if not _should_activate():
		return

	_queue_mutex = Mutex.new()
	_commands = MCPCommands.new()
	_running = true

	# Start stdin reading thread
	_stdin_thread = Thread.new()
	_stdin_thread.start(_stdin_loop)

	print("[MCP Bridge] Initialized and ready")


func _should_activate() -> bool:
	# Must be a debug build
	if not OS.is_debug_build():
		return false

	# Must have --mcp-bridge flag
	var args := OS.get_cmdline_args()
	return "--mcp-bridge" in args or "--mcp-bridge" in OS.get_cmdline_user_args()


func _stdin_loop() -> void:
	while _running:
		# Read a line from stdin (blocking)
		var line := OS.read_string_from_stdin()

		if line.length() > 0:
			line = line.strip_edges()
			if line.length() > 0:
				var msg := MCPProtocol.decode(line)
				if msg != null:
					_queue_message(msg)


func _queue_message(msg: Dictionary) -> void:
	_queue_mutex.lock()
	_message_queue.append(msg)
	_queue_mutex.unlock()


func _process(_delta: float) -> void:
	if not _running:
		return

	# Process queued messages on the main thread
	_queue_mutex.lock()
	var messages := _message_queue.duplicate()
	_message_queue.clear()
	_queue_mutex.unlock()

	for msg in messages:
		_process_message(msg)


func _process_message(msg: Dictionary) -> void:
	# Execute command and send response
	var response = _commands.execute(msg)

	# Handle async responses (awaited)
	if response is Dictionary:
		_send_response(response)


func _send_response(response: Dictionary) -> void:
	var encoded := MCPProtocol.encode(response)
	print(encoded)


func _exit_tree() -> void:
	_running = false

	if _stdin_thread and _stdin_thread.is_started():
		# Note: The thread may be blocked on stdin read
		# It will terminate when the process exits
		_stdin_thread.wait_to_finish()
