@tool
extends EditorPlugin
## MCP Bridge Plugin
## Enables communication between MCP server and Godot for AI-assisted game development

const AUTOLOAD_NAME := "MCPBridgeAutoload"


func _enter_tree() -> void:
	# Add the autoload that handles runtime communication
	add_autoload_singleton(AUTOLOAD_NAME, "res://addons/mcp_bridge/mcp_bridge_autoload.gd")


func _exit_tree() -> void:
	remove_autoload_singleton(AUTOLOAD_NAME)
