---
title: Markdown Front Matter
description: It was a cloudy spring day

story_required_words:
    - something
    - February
    - bought
    - Saturday
    - defeated
    - trolly
    - treat
    - greedy
    - breakfast
story_location: Hogwarts School of Witchcraft and Wizardry
story_genre: adventure
story_interests: basketball
story_style: Young Adult
---
```math
\begin{array}{rl}
\text{Name:} & \raisebox{-1.5ex}{\underline{\phantom{aaaaaaaaaaaaaaaaaa}}} &
\text{Date:} & \raisebox{-1.5ex}{\underline{\phantom{aaaaaaaaaaaaaaaaaa}}} \\
\end{array}
```

<style>
.border-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    width: 100%;
    height: 1 vmin;
}

.cell {
    border: 1px solid black;
    padding: 24px 0;
    box-sizing: border-box;
    font-size: 2em;
}

.letter-box {
    border: 1px solid black; width: 1em;
    position: relative;
    top: 15px;
}
</style>

:h1[Complete The Word]{.justify-items-center.text-center}

```lua
function replace_vars(str_or_table, maybe_vars)
  local str, vars

  -- Support both replace_vars("text", {vars}) and replace_vars{ "text", key1 = val1, ... }
  if type(str_or_table) == "table" then
    vars = str_or_table
    str = vars[1]
  else
    str = str_or_table
    vars = maybe_vars
  end

  return (string.gsub(str, "{(.-)}", function(key)
    return tostring(vars[key] or "{" .. key .. "}")
  end))
end

-- Example usage:
output = replace_vars{
  [[Hello {name}, welcome to {company}.]],
  name = "Elise",
  company = "OpenAI"
}

print(output)

print("<bold>Title</bold>:", input.title)
print("Location:", input.story_location)
print("All story_required_words:")
for i, word in ipairs(input.story_required_words) do
    print("-", word)
end

```
  
:::div{.border-grid}
```lua
print([[<div class="cell content-center text-center">:monkey:</div>
<div class="cell content-center text-center"><span class="letter-box">
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
</span>onkey</div>
]])


```
:div[:wolf:]{.cell.content-center.text-center}
:div[<span class="letter-box">
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
</span>olf]{.cell.content-center.text-center}
:div[:lion:]{.cell.content-center.text-center}
:div[<span class="letter-box">
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
</span>ion]{.cell.content-center.text-center}
:div[:horse:]{.cell.content-center.text-center}
:div[<span class="letter-box">
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
</span>orse]{.cell.content-center.text-center}
:div[:deer:]{.cell.content-center.text-center}
:div[<span class="letter-box">
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
</span>eer]{.cell.content-center.text-center}
:div[:cow:]{.cell.content-center.text-center}
:div[<span class="letter-box">
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
</span>ow]{.cell.content-center.text-center}
:div[:pig:]{.cell.content-center.text-center}
:div[<span class="letter-box">
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
</span>ig]{.cell.content-center.text-center}
:div[:koala:]{.cell.content-center.text-center}
:div[<span class="letter-box">
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
</span>oala]{.cell.content-center.text-center}
:div[:rhinoceros:]{.cell.content-center.text-center}
:div[<span class="letter-box">
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
</span>hinoceros]{.cell.content-center.text-center}
:::