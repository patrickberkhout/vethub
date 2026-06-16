<script lang="ts">
	import { getPets } from '$lib/api/pet/PetController';
	import type { PetResponse } from '$lib/api/models';
	import * as Table from '$lib/components/ui/table';
	import { PawPrint } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let pets = $state<PetResponse[]>([]);
	let loading = $state(true);
	let showDeleted = $state(false);

	async function loadPets() {
		loading = true;
		try {
			pets = await getPets(showDeleted);
		} catch (err) {
			toast.error('Failed to load pets');
			console.error('Error loading pets:', err);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		showDeleted;
		loadPets();
	});
</script>

<svelte:head>
	<title>Pets | VetHub</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Header -->
	<div class="mb-8 flex items-center gap-3">
		<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
			<PawPrint class="h-6 w-6 text-accent" />
		</div>
		<div>
			<h1 class="text-2xl font-bold text-foreground">Pets</h1>
			<p class="text-sm text-muted-foreground">Browse all registered pets</p>
		</div>
	</div>

	<!-- Progress bar -->
	{#if loading}
		<div class="mb-4 h-1 w-full overflow-hidden rounded-full bg-muted">
			<div class="h-full animate-pulse rounded-full bg-primary"></div>
		</div>
	{/if}

	<!-- Table -->
	<div class="card overflow-hidden">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Pet Name</Table.Head>
					<Table.Head>Date of Birth</Table.Head>
					<Table.Head>Owner</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if !loading && pets.length === 0}
					<Table.Row>
						<Table.Cell colspan={3} class="py-12 text-center text-muted-foreground">
							No pets found.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each pets as pet (pet.id)}
						<Table.Row class="hover:bg-muted/50 {pet.deleted ? 'opacity-50' : ''}">
							<Table.Cell class={pet.deleted ? 'line-through' : ''}>
								{pet.name}
							</Table.Cell>
							<Table.Cell class={pet.deleted ? 'line-through' : ''}>
								{pet.birthDate}
							</Table.Cell>
							<Table.Cell>
								<a
									href="/owners/{pet.ownerId}"
									class="text-primary hover:underline {pet.deleted ? 'line-through' : ''}"
								>
									{pet.ownerFirstName} {pet.ownerLastName}
								</a>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	<!-- Show deleted toggle -->
	<label class="mt-4 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
		<input type="checkbox" bind:checked={showDeleted} class="h-4 w-4 cursor-pointer" />
		Show deleted pets
	</label>
</div>
