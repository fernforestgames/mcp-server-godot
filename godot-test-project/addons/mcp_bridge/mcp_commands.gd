class_name MCPCommands
extends RefCounted
## Command dispatcher for MCP bridge

const VERSION := "1.0"
const CAPABILITIES := ["screenshot", "nodes", "input", "scene"]


## Execute a command and return the response
func execute(msg: Dictionary) -> Dictionary:
	var command: String = msg.get("command", "")
	var request_id: String = msg.get("id", "")
	var payload: Variant = msg.get("payload", {})

	match command:
		"handshake":
			return _handle_handshake(request_id, payload)
		"screenshot":
			return await _handle_screenshot(request_id, payload)
		"get_scene_tree":
			return _handle_get_scene_tree(request_id, payload)
		"get_node":
			return _handle_get_node(request_id, payload)
		"set_property":
			return _handle_set_property(request_id, payload)
		"call_method":
			return _handle_call_method(request_id, payload)
		"change_scene":
			return _handle_change_scene(request_id, payload)
		"input_action":
			return _handle_input_action(request_id, payload)
		"input_key":
			return _handle_input_key(request_id, payload)
		"input_mouse_button":
			return _handle_input_mouse_button(request_id, payload)
		"input_mouse_motion":
			return _handle_input_mouse_motion(request_id, payload)
		_:
			return MCPProtocol.create_error_response(
				request_id, command, "UNKNOWN_COMMAND", "Unknown command: " + command
			)


func _handle_handshake(request_id: String, _payload: Variant) -> Dictionary:
	return MCPProtocol.create_response(request_id, "handshake", {
		"version": VERSION,
		"capabilities": CAPABILITIES
	})


func _handle_screenshot(request_id: String, payload: Variant) -> Dictionary:
	var format: String = payload.get("format", "png") if payload is Dictionary else "png"

	# Wait for the current frame to finish rendering
	await RenderingServer.frame_post_draw

	var viewport := _get_main_viewport()
	if viewport == null:
		return MCPProtocol.create_error_response(
			request_id, "screenshot", "NO_VIEWPORT", "Could not find main viewport"
		)

	var img := viewport.get_texture().get_image()
	if img == null:
		return MCPProtocol.create_error_response(
			request_id, "screenshot", "CAPTURE_FAILED", "Failed to capture viewport image"
		)

	var buffer: PackedByteArray
	match format:
		"jpeg", "jpg":
			buffer = img.save_jpg_to_buffer()
		_:
			buffer = img.save_png_to_buffer()

	return MCPProtocol.create_response(request_id, "screenshot", {
		"data": Marshalls.raw_to_base64(buffer),
		"width": img.get_width(),
		"height": img.get_height()
	})


func _handle_get_scene_tree(request_id: String, _payload: Variant) -> Dictionary:
	var root := _get_scene_root()
	if root == null:
		return MCPProtocol.create_error_response(
			request_id, "get_scene_tree", "NO_SCENE", "No scene loaded"
		)

	return MCPProtocol.create_response(request_id, "get_scene_tree", {
		"root": _serialize_node_tree(root)
	})


func _handle_get_node(request_id: String, payload: Variant) -> Dictionary:
	if not payload is Dictionary or not payload.has("path"):
		return MCPProtocol.create_error_response(
			request_id, "get_node", "INVALID_PARAMS", "Missing 'path' parameter"
		)

	var node_path: String = payload.get("path", "")
	var node := _get_node_by_path(node_path)

	if node == null:
		return MCPProtocol.create_error_response(
			request_id, "get_node", "NODE_NOT_FOUND", "Node not found: " + node_path
		)

	return MCPProtocol.create_response(request_id, "get_node", {
		"node": _serialize_node(node, false)
	})


func _handle_set_property(request_id: String, payload: Variant) -> Dictionary:
	if not payload is Dictionary:
		return MCPProtocol.create_error_response(
			request_id, "set_property", "INVALID_PARAMS", "Invalid payload"
		)

	var node_path: String = payload.get("path", "")
	var property: String = payload.get("property", "")
	var value: Variant = payload.get("value")

	if node_path.is_empty() or property.is_empty():
		return MCPProtocol.create_error_response(
			request_id, "set_property", "INVALID_PARAMS", "Missing 'path' or 'property' parameter"
		)

	var node := _get_node_by_path(node_path)
	if node == null:
		return MCPProtocol.create_error_response(
			request_id, "set_property", "NODE_NOT_FOUND", "Node not found: " + node_path
		)

	if not property in node:
		return MCPProtocol.create_error_response(
			request_id, "set_property", "PROPERTY_NOT_FOUND", "Property not found: " + property
		)

	node.set(property, value)

	return MCPProtocol.create_response(request_id, "set_property", {
		"success": true
	})


func _handle_call_method(request_id: String, payload: Variant) -> Dictionary:
	if not payload is Dictionary:
		return MCPProtocol.create_error_response(
			request_id, "call_method", "INVALID_PARAMS", "Invalid payload"
		)

	var node_path: String = payload.get("path", "")
	var method: String = payload.get("method", "")
	var args: Array = payload.get("args", [])

	if node_path.is_empty() or method.is_empty():
		return MCPProtocol.create_error_response(
			request_id, "call_method", "INVALID_PARAMS", "Missing 'path' or 'method' parameter"
		)

	var node := _get_node_by_path(node_path)
	if node == null:
		return MCPProtocol.create_error_response(
			request_id, "call_method", "NODE_NOT_FOUND", "Node not found: " + node_path
		)

	if not node.has_method(method):
		return MCPProtocol.create_error_response(
			request_id, "call_method", "METHOD_NOT_FOUND", "Method not found: " + method
		)

	var result = node.callv(method, args)

	return MCPProtocol.create_response(request_id, "call_method", {
		"result": result
	})


func _handle_change_scene(request_id: String, payload: Variant) -> Dictionary:
	if not payload is Dictionary or not payload.has("scenePath"):
		return MCPProtocol.create_error_response(
			request_id, "change_scene", "INVALID_PARAMS", "Missing 'scenePath' parameter"
		)

	var scene_path: String = payload.get("scenePath", "")

	if not ResourceLoader.exists(scene_path):
		return MCPProtocol.create_error_response(
			request_id, "change_scene", "SCENE_NOT_FOUND", "Scene not found: " + scene_path
		)

	var tree := Engine.get_main_loop() as SceneTree
	if tree == null:
		return MCPProtocol.create_error_response(
			request_id, "change_scene", "NO_SCENE_TREE", "Could not get SceneTree"
		)

	var error := tree.change_scene_to_file(scene_path)
	if error != OK:
		return MCPProtocol.create_error_response(
			request_id, "change_scene", "CHANGE_FAILED", "Failed to change scene: " + str(error)
		)

	return MCPProtocol.create_response(request_id, "change_scene", {
		"success": true
	})


func _handle_input_action(request_id: String, payload: Variant) -> Dictionary:
	if not payload is Dictionary:
		return MCPProtocol.create_error_response(
			request_id, "input_action", "INVALID_PARAMS", "Invalid payload"
		)

	var action: String = payload.get("action", "")
	var pressed: bool = payload.get("pressed", true)
	var strength: float = payload.get("strength", 1.0)

	if action.is_empty():
		return MCPProtocol.create_error_response(
			request_id, "input_action", "INVALID_PARAMS", "Missing 'action' parameter"
		)

	if not InputMap.has_action(action):
		return MCPProtocol.create_error_response(
			request_id, "input_action", "ACTION_NOT_FOUND", "Input action not found: " + action
		)

	if pressed:
		Input.action_press(action, strength)
	else:
		Input.action_release(action)

	return MCPProtocol.create_response(request_id, "input_action", {
		"success": true
	})


func _handle_input_key(request_id: String, payload: Variant) -> Dictionary:
	if not payload is Dictionary:
		return MCPProtocol.create_error_response(
			request_id, "input_key", "INVALID_PARAMS", "Invalid payload"
		)

	var keycode: int = payload.get("keycode", 0)
	var pressed: bool = payload.get("pressed", true)

	var event := InputEventKey.new()
	event.keycode = keycode
	event.pressed = pressed
	event.shift_pressed = payload.get("shift", false)
	event.ctrl_pressed = payload.get("ctrl", false)
	event.alt_pressed = payload.get("alt", false)
	event.meta_pressed = payload.get("meta", false)

	Input.parse_input_event(event)

	return MCPProtocol.create_response(request_id, "input_key", {
		"success": true
	})


func _handle_input_mouse_button(request_id: String, payload: Variant) -> Dictionary:
	if not payload is Dictionary:
		return MCPProtocol.create_error_response(
			request_id, "input_mouse_button", "INVALID_PARAMS", "Invalid payload"
		)

	var button: int = payload.get("button", MOUSE_BUTTON_LEFT)
	var pressed: bool = payload.get("pressed", true)
	var pos_data: Variant = payload.get("position", {})

	var position := Vector2.ZERO
	if pos_data is Dictionary:
		position = Vector2(pos_data.get("x", 0), pos_data.get("y", 0))

	var event := InputEventMouseButton.new()
	event.button_index = button
	event.pressed = pressed
	event.position = position
	event.global_position = position

	Input.parse_input_event(event)

	return MCPProtocol.create_response(request_id, "input_mouse_button", {
		"success": true
	})


func _handle_input_mouse_motion(request_id: String, payload: Variant) -> Dictionary:
	if not payload is Dictionary:
		return MCPProtocol.create_error_response(
			request_id, "input_mouse_motion", "INVALID_PARAMS", "Invalid payload"
		)

	var rel_data: Variant = payload.get("relative", {})
	var pos_data: Variant = payload.get("position")

	var relative := Vector2.ZERO
	if rel_data is Dictionary:
		relative = Vector2(rel_data.get("x", 0), rel_data.get("y", 0))

	var event := InputEventMouseMotion.new()
	event.relative = relative

	if pos_data is Dictionary:
		var position := Vector2(pos_data.get("x", 0), pos_data.get("y", 0))
		event.position = position
		event.global_position = position

	Input.parse_input_event(event)

	return MCPProtocol.create_response(request_id, "input_mouse_motion", {
		"success": true
	})


# Helper functions

func _get_main_viewport() -> Viewport:
	var tree := Engine.get_main_loop() as SceneTree
	if tree:
		return tree.root.get_viewport()
	return null


func _get_scene_root() -> Node:
	var tree := Engine.get_main_loop() as SceneTree
	if tree and tree.current_scene:
		return tree.current_scene
	return null


func _get_node_by_path(path: String) -> Node:
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null:
		return null

	# Handle absolute paths starting with /root
	if path.begins_with("/root"):
		return tree.root.get_node_or_null(path.substr(5))  # Remove "/root"

	# Handle relative paths from current scene
	if tree.current_scene:
		return tree.current_scene.get_node_or_null(path)

	return null


func _serialize_node(node: Node, include_children: bool = false) -> Dictionary:
	var result := {
		"name": node.name,
		"type": node.get_class(),
		"path": str(node.get_path()),
		"properties": _get_exported_properties(node)
	}

	if include_children and node.get_child_count() > 0:
		var children: Array[Dictionary] = []
		for child in node.get_children():
			children.append(_serialize_node(child, true))
		result["children"] = children

	return result


func _serialize_node_tree(node: Node) -> Dictionary:
	return _serialize_node(node, true)


func _get_exported_properties(node: Node) -> Dictionary:
	var props := {}
	var prop_list := node.get_property_list()

	for prop in prop_list:
		# Only include exported properties (PROPERTY_USAGE_EDITOR)
		if prop.usage & PROPERTY_USAGE_EDITOR:
			var value = node.get(prop.name)
			# Only include serializable values
			if _is_serializable(value):
				props[prop.name] = value

	return props


func _is_serializable(value: Variant) -> bool:
	match typeof(value):
		TYPE_NIL, TYPE_BOOL, TYPE_INT, TYPE_FLOAT, TYPE_STRING:
			return true
		TYPE_VECTOR2, TYPE_VECTOR2I, TYPE_VECTOR3, TYPE_VECTOR3I:
			return true
		TYPE_COLOR, TYPE_RECT2, TYPE_RECT2I:
			return true
		TYPE_ARRAY, TYPE_DICTIONARY:
			return true
		TYPE_PACKED_BYTE_ARRAY, TYPE_PACKED_INT32_ARRAY, TYPE_PACKED_INT64_ARRAY:
			return true
		TYPE_PACKED_FLOAT32_ARRAY, TYPE_PACKED_FLOAT64_ARRAY:
			return true
		TYPE_PACKED_STRING_ARRAY, TYPE_PACKED_VECTOR2_ARRAY, TYPE_PACKED_VECTOR3_ARRAY:
			return true
		_:
			return false
