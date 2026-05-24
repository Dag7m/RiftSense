"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/api";
import { createNode } from "@/lib/queries";
import { NodeCreateSchema, type NodeCreateInput } from "@/lib/types";

export function NodeForm() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const form = useForm<NodeCreateInput>({
    resolver: zodResolver(NodeCreateSchema),
    defaultValues: {
      node_id: "",
      name: "",
      latitude: 0,
      longitude: 0,
      elevation: undefined,
      status: "active",
      firmware_version: "",
    },
  });

  const mutation = useMutation({
    mutationFn: createNode,
    onSuccess: () => {
      toast.success("Node installed");
      queryClient.invalidateQueries({ queryKey: ["sensor", "nodes"] });
      setOpen(false);
      form.reset();
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Could not install node")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Install node
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install sensor node</DialogTitle>
          <DialogDescription>
            Register a new ESP32-class sensor in the network.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="node-id">Node ID</Label>
              <Input
                id="node-id"
                placeholder="ESP32_NODE_001"
                {...form.register("node_id")}
              />
              {form.formState.errors.node_id && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.node_id.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="node-name">Name</Label>
              <Input id="node-name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Latitude</Label>
              <Input
                type="number"
                step="any"
                {...form.register("latitude", { valueAsNumber: true })}
              />
              {form.formState.errors.latitude && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.latitude.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Longitude</Label>
              <Input
                type="number"
                step="any"
                {...form.register("longitude", { valueAsNumber: true })}
              />
              {form.formState.errors.longitude && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.longitude.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Elevation (m)</Label>
              <Input
                type="number"
                step="any"
                {...form.register("elevation", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) =>
                  form.setValue("status", v as NodeCreateInput["status"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Firmware version</Label>
              <Input
                placeholder="1.0.0"
                {...form.register("firmware_version")}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Installing…" : "Install"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
