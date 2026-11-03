var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, } from "@nestjs/common";
import { ResourcesService } from "./resources.service";
let ResourcesController = class ResourcesController {
    resources;
    constructor(resources) {
        this.resources = resources;
    }
    count(resource) {
        return this.resources.count(resource);
    }
    list(resource, query) {
        return this.resources.list(resource, query);
    }
    findOne(resource, id) {
        return this.resources.findOne(resource, id);
    }
    create(resource, data) {
        return this.resources.create(resource, data);
    }
    update(resource, id, data) {
        return this.resources.update(resource, id, data);
    }
    remove(resource, id) {
        return this.resources.remove(resource, id);
    }
};
__decorate([
    Get(":resource/count"),
    __param(0, Param("resource")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "count", null);
__decorate([
    Get(":resource"),
    __param(0, Param("resource")),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "list", null);
__decorate([
    Get(":resource/:id"),
    __param(0, Param("resource")),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "findOne", null);
__decorate([
    Post(":resource"),
    __param(0, Param("resource")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "create", null);
__decorate([
    Patch(":resource/:id"),
    __param(0, Param("resource")),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "update", null);
__decorate([
    Delete(":resource/:id"),
    __param(0, Param("resource")),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "remove", null);
ResourcesController = __decorate([
    Controller("api/resources"),
    __metadata("design:paramtypes", [ResourcesService])
], ResourcesController);
export { ResourcesController };
