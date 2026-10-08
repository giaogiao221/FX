function Test-OwnedProcess {
    param([string]$CommandLine, [string]$ExpectedRoot, [int]$ProcessId, [int[]]$ProtectedProcessIds)
    if ($ProtectedProcessIds -contains $ProcessId) { return $false }
    if (-not $CommandLine -or -not $ExpectedRoot -or -not [IO.Path]::IsPathRooted($ExpectedRoot)) { return $false }
    $root = $ExpectedRoot.Replace('/', '\').TrimEnd('\') + '\'
    return $CommandLine.Replace('/', '\').IndexOf($root, [StringComparison]::OrdinalIgnoreCase) -ge 0
}
