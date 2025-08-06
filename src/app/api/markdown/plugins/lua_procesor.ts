

import {fromMarkdown} from 'mdast-util-from-markdown';
import type { Root } from 'mdast';
import { lua, lauxlib, lualib, to_jsstring, to_luastring } from 'fengari';
import type { Node as UnistNode } from 'unist';
import {visit} from 'unist-util-visit';
import YAML from 'yaml';

import { getMetaFromRoot, Metadata } from './metadata';


interface MdastCodeNode extends UnistNode {
  type: 'code';
  lang?: string;
  meta?: string;
  value: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function luaValueToString(L: any, idx: any) {
    // Always use luaL_tolstring, which pushes the string on top of the stack
    lauxlib.luaL_tolstring(L, idx);
    // Now top of stack is a string
    const s = lua.lua_tostring(L, -1); // Uint8Array or null
    let result;
    if (s === null) {
        result = '';
    } else {
        result = to_jsstring(s);
    }
    lua.lua_pop(L, 1); // Remove the string from the stack
    return result;
}

// Recursively push a JS object as a Lua table onto the stack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pushJsToLua(L: any, obj: any) {
    if (Array.isArray(obj)) {
        lua.lua_createtable(L, obj.length, 0);
        obj.forEach((val, i) => {
            pushJsToLua(L, val);
            lua.lua_seti(L, -2, i + 1);
        });
    } else if (obj !== null && typeof obj === 'object') {
        lua.lua_createtable(L, 0, Object.keys(obj).length);
        Object.entries(obj).forEach(([key, val]) => {
            pushJsToLua(L, val);
            lua.lua_setfield(L, -2, to_luastring(key));
        });
    } else if (typeof obj === 'string') {
        lua.lua_pushstring(L, to_luastring(obj));
    } else if (typeof obj === 'number') {
        lua.lua_pushnumber(L, obj);
    } else if (typeof obj === 'boolean') {
        lua.lua_pushboolean(L, obj);
    } else {
        lua.lua_pushnil(L);
    }
}

// Safely convert Lua return value to JS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function luaReturnToJs(L: any, idx: any) {
    switch (lua.lua_type(L, idx)) {
        case lua.LUA_TNIL:
            return null;
        case lua.LUA_TSTRING:
            return to_jsstring(lua.lua_tostring(L, idx));
        case lua.LUA_TNUMBER:
            return lua.lua_tonumber(L, idx);
        case lua.LUA_TBOOLEAN:
            return !!lua.lua_toboolean(L, idx);
        case lua.LUA_TTABLE:
            return '[Lua table]';
        default:
            return `[Lua type: ${lua.lua_typename(L, lua.lua_type(L, idx))}]`;
    }
}

function runLuaString(luaCode: string, inputObject: Metadata) {
    const L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);

    const outputBuffer: string[] = [];

    lua.lua_pushjsfunction(L, function(L: any) {
        const n = lua.lua_gettop(L);
        const parts = [];
        for (let i = 1; i <= n; i++) {
            parts.push(luaValueToString(L, i));
        }
        outputBuffer.push(parts.join('\t'));
        return 0;
    });
    lua.lua_setglobal(L, to_luastring('print'));

    pushJsToLua(L, inputObject);
    lua.lua_setglobal(L, to_luastring('input'));

    if (lauxlib.luaL_loadstring(L, to_luastring(luaCode)) === lua.LUA_OK) {
        if (lua.lua_pcall(L, 0, lua.LUA_MULTRET, 0) === lua.LUA_OK) {
            let returnValue = null;
            const nResults = lua.lua_gettop(L);
            if (nResults > 0) {
                returnValue = luaReturnToJs(L, -1);
                lua.lua_pop(L, 1);
            }
            return {
                print: outputBuffer.join('\n'),
                return: returnValue
            };
        } else {
            const err = lua.lua_tojsstring(L, -1);
            lua.lua_pop(L, 1);
            throw new Error(err);
        }
    } else {
        const err = lua.lua_tojsstring(L, -1);
        lua.lua_pop(L, 1);
        throw new Error(err);
    }
}

export default function luaProcessing() {
  return function transformer(tree: Root) {
    const metadata = getMetaFromRoot(tree);

    visit(tree, (node: UnistNode) => {
      if (node.type === 'code') {
        const codeNode = node as MdastCodeNode;
        if (codeNode.lang === 'lua') {
          
            let result = '';
            try {
              const { print } = runLuaString(codeNode.value, metadata);
              result = print;
              if (result !== null) {
                console.log("Lua returned:", result);
              }
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              result = "Lua Error:" + errorMessage;
            }

            const root = fromMarkdown(result);
            
            const transformedNode = node as any;
            transformedNode.type = 'containerDirective';
            transformedNode.name = 'div';
            transformedNode.children = root.children;
            delete transformedNode.value;
            delete transformedNode.lang;
            delete transformedNode.meta;
        }
      }
    });
  };
}
