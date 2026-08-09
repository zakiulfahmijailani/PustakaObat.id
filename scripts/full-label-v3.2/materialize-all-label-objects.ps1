param(
  [Parameter(Mandatory = $true)][string]$EnvFile,
  [Parameter(Mandatory = $true)][string]$ExpectedHost
)

$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'materialize-label-objects.mjs'

foreach ($shard in 0..15) {
  Write-Output ("Starting full-label object materialization for shard {0}" -f $shard)
  & node $scriptPath --env $EnvFile --expected-host $ExpectedHost --shard $shard --apply YES
  if ($LASTEXITCODE -ne 0) {
    throw ("Materialization stopped at shard {0} with exit code {1}" -f $shard, $LASTEXITCODE)
  }
}

Write-Output 'Full-label object materialization completed.'
