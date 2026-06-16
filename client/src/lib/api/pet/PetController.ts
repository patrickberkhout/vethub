/**
 * Pet API Controller
 *
 * Thin API layer for pet-related operations.
 * Handles HTTP communication only - no business logic.
 */
import { client } from '$lib/api/client';
import type {
	PetResponse,
	CreatePetRequest,
	UpdatePetRequest
} from '$lib/api/models';

/**
 * Get all pets
 */
export async function getPets(includeDeleted = false): Promise<PetResponse[]> {
	const { data, error } = await client.GET('/v1/pets', {
		params: { query: { includeDeleted } }
	});
	if (error) throw error;
	return data ?? [];
}

/**
 * Get pet by ID
 */
export async function getPetById(id: number): Promise<PetResponse> {
	const { data, error } = await client.GET('/v1/pets/{id}', {
		params: { path: { id } }
	});
	if (error) throw error;
	if (!data) throw new Error('Pet not found');
	return data;
}

/**
 * Get pets by owner ID
 */
export async function getPetsByOwnerId(ownerId: number): Promise<PetResponse[]> {
	const { data, error } = await client.GET('/v1/owners/{ownerId}/pets', {
		params: { path: { ownerId } }
	});
	if (error) throw error;
	return data ?? [];
}

/**
 * Create a new pet
 */
export async function createPet(request: CreatePetRequest): Promise<PetResponse> {
	const { data, error } = await client.POST('/v1/pets', {
		body: request
	});
	if (error) throw error;
	if (!data) throw new Error('Failed to create pet');
	return data;
}

/**
 * Create a new pet for a specific owner
 */
export async function createPetForOwner(ownerId: number, request: Omit<CreatePetRequest, 'ownerId'>): Promise<PetResponse> {
	const { data, error } = await client.POST('/v1/owners/{ownerId}/pets', {
		params: { path: { ownerId } },
		body: request
	});
	if (error) throw error;
	if (!data) throw new Error('Failed to create pet');
	return data;
}

/**
 * Update an existing pet
 */
export async function updatePet(id: number, request: UpdatePetRequest): Promise<PetResponse> {
	const { data, error } = await client.PUT('/v1/pets/{id}', {
		params: { path: { id } },
		body: request
	});
	if (error) throw error;
	if (!data) throw new Error('Failed to update pet');
	return data;
}

/**
 * Delete a pet
 */
export async function deletePet(id: number): Promise<void> {
	const { error } = await client.DELETE('/v1/pets/{id}', {
		params: { path: { id } }
	});
	if (error) throw error;
}

/**
 * Get a specific pet for an owner
 */
export async function getPetForOwner(ownerId: number, petId: number): Promise<PetResponse> {
	const { data, error } = await client.GET('/v1/owners/{ownerId}/pets/{petId}', {
		params: { path: { ownerId, petId } }
	});
	if (error) throw error;
	if (!data) throw new Error('Pet not found');
	return data;
}

/**
 * Update a pet for a specific owner
 */
export async function updatePetForOwner(
	ownerId: number,
	petId: number,
	request: UpdatePetRequest
): Promise<PetResponse> {
	const { data, error } = await client.PUT('/v1/owners/{ownerId}/pets/{petId}', {
		params: { path: { ownerId, petId } },
		body: request
	});
	if (error) throw error;
	if (!data) throw new Error('Failed to update pet');
	return data;
}

/**
 * Delete a pet for a specific owner
 */
export async function deletePetForOwner(ownerId: number, petId: number): Promise<void> {
	const { error } = await client.DELETE('/v1/owners/{ownerId}/pets/{petId}', {
		params: { path: { ownerId, petId } }
	});
	if (error) throw error;
}
